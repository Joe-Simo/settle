import { createHash } from "node:crypto";
import { type Cents, fmtShort } from "./money";
import { EMAIL_RE, type Policy } from "./schema";
import type { Settlement } from "./settle";

/**
 * Guardrails around agentic payments. The agent can propose a payout, but money only moves
 * when every check here passes and the right number of humans have approved.
 */

export interface PolicyCheck {
  id: string;
  ok: boolean;
  severity: "block" | "hold" | "info";
  message: string;
}

export interface PayoutItem {
  payeeId: string;
  name: string;
  receiver: string;
  amountCents: Cents;
  note: string;
}

export interface PolicyResult {
  checks: PolicyCheck[];
  payable: PayoutItem[];
  held: { payeeId: string; name: string; reason: string }[];
  totalCents: Cents;
  approvalsNeeded: 1 | 2;
  blocked: boolean;
  senderBatchId: string;
}

export function batchIdFor(showId: string, items: PayoutItem[], runId?: string): string {
  const h = createHash("sha256")
    .update(JSON.stringify(runId ? [showId, runId, items.map((i) => [i.payeeId, i.receiver, i.amountCents])] : [showId, items.map((i) => [i.payeeId, i.receiver, i.amountCents])]))
    .digest("hex")
    .slice(0, 16);
  return `settle-${showId}-${h}`.slice(0, 127);
}

export function evaluate(settlement: Settlement, policy: Policy, notePrefix = "Settlement", runId?: string): PolicyResult {
  const checks: PolicyCheck[] = [];
  const payable: PayoutItem[] = [];
  const held: PolicyResult["held"] = [];

  for (const p of settlement.payees) {
    if (p.dueCents === 0) {
      held.push({ payeeId: p.id, name: p.name, reason: p.owesBackCents > 0 ? `owes ${fmtShort(p.owesBackCents)} back` : "nothing due" });
      continue;
    }
    if (!EMAIL_RE.test(p.email)) {
      held.push({ payeeId: p.id, name: p.name, reason: "no valid PayPal email" });
      checks.push({ id: `email-${p.id}`, ok: false, severity: "hold", message: `${p.name}: no valid PayPal email, held.` });
      continue;
    }
    if (p.dueCents > policy.perPayeeCapCents) {
      held.push({ payeeId: p.id, name: p.name, reason: `over the ${fmtShort(policy.perPayeeCapCents)} per-payee cap` });
      checks.push({
        id: `cap-${p.id}`,
        ok: false,
        severity: "hold",
        message: `${p.name}: ${fmtShort(p.dueCents)} is over the ${fmtShort(policy.perPayeeCapCents)} per-payee cap, held for manual payment.`,
      });
      continue;
    }
    payable.push({
      payeeId: p.id,
      name: p.name,
      receiver: p.email,
      amountCents: p.dueCents,
      note: `${notePrefix}: ${p.dealLabel}`.slice(0, 4000),
    });
  }

  const totalCents = payable.reduce((a, i) => a + i.amountCents, 0);
  checks.push({
    id: "caps",
    ok: true,
    severity: "info",
    message: `Per-payee cap of ${fmtShort(policy.perPayeeCapCents)} checked for all ${settlement.payees.length} payees.`,
  });

  const receivers = payable.map((p) => p.receiver.toLowerCase());
  const dupes = receivers.filter((r, i) => receivers.indexOf(r) !== i);
  checks.push({
    id: "duplicates",
    ok: dupes.length === 0,
    severity: "block",
    message: dupes.length ? `Same PayPal email used twice: ${[...new Set(dupes)].join(", ")}.` : "No PayPal email is paid twice.",
  });

  const merch = settlement.payees.reduce((a, p) => a + p.merchNetCents, 0);
  checks.push({
    id: "funds",
    ok: totalCents <= settlement.grossCents + merch,
    severity: "block",
    message: `Payouts of ${fmtShort(totalCents)} vs ${fmtShort(settlement.grossCents + merch)} collected in tickets and merch.`,
  });

  checks.push({
    id: "declared",
    ok: true,
    severity: "info",
    message:
      settlement.declaredGrossCents === 0
        ? "Every ticket dollar is a PayPal order verified with the Orders API."
        : `${fmtShort(settlement.verifiedGrossCents)} verified against PayPal orders; ${fmtShort(settlement.declaredGrossCents)} box office declared by the promoter.`,
  });

  const approvalsNeeded: 1 | 2 = totalCents > policy.dualApprovalOverCents ? 2 : 1;
  checks.push({
    id: "approvals",
    ok: true,
    severity: "info",
    message:
      approvalsNeeded === 2
        ? `Batch is over ${fmtShort(policy.dualApprovalOverCents)}, so two different people must approve.`
        : "One approval is enough for this batch.",
  });

  const blocked = checks.some((c) => !c.ok && c.severity === "block") || payable.length === 0;
  return { checks, payable, held, totalCents, approvalsNeeded, blocked, senderBatchId: batchIdFor(settlement.showId, payable, runId) };
}

export function approvalsValid(needed: 1 | 2, approvers: string[]): { ok: boolean; reason?: string } {
  const names = [...new Set(approvers.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (names.length < needed) {
    return { ok: false, reason: needed === 2 ? "Two different approvers are required." : "An approver is required." };
  }
  return { ok: true };
}
