import { z } from "zod";
import { chatJson, llmEnabled, tidy } from "./llm";
import { fmt, fmtShort } from "./money";
import type { PolicyResult } from "./policy";
import type { Settlement } from "./settle";

/**
 * The AI writes the human parts: a short note to each payee and the agent's payout plan.
 * Every dollar figure it writes must already exist in the deterministic settlement. If it invents a number,
 * names an unknown payee, or picks a tool that is not allowed, its output is thrown away and the template is used.
 */

export function allowedFigures(s: Settlement): Set<string> {
  const out = new Set<string>();
  const add = (c: number) => {
    out.add(fmt(Math.abs(c)));
    out.add(fmtShort(Math.abs(c)));
  };
  [s.grossCents, s.adjustedGrossCents, s.taxCents, s.showExpensesCents, s.staffCents, s.talentCents, s.promoterNetCents, s.totalDueCents, s.venueMerchCents].forEach(add);
  if (s.barInvoice) add(s.barInvoice.amountCents);
  for (const p of s.payees) {
    [p.earnedCents, p.bonusCents, p.merchNetCents, p.depositCents, p.dueCents, p.earnedCents + p.bonusCents].forEach(add);
    p.lines.forEach((l) => add(l.amountCents));
    for (const f of p.facts) for (const m of f.matchAll(/\$[\d,]+(?:\.\d{2})?/g)) out.add(m[0]);
  }
  return out;
}

/** True when every $ figure in text is one we computed. */
export function grounded(text: string, allowed: Set<string>): boolean {
  for (const m of text.matchAll(/\$[\d,]+(?:\.\d{1,2})?/g)) {
    const v = m[0];
    const alt = v.includes(".") ? v.replace(/\.00$/, "") : `${v}.00`;
    if (!allowed.has(v) && !allowed.has(alt)) return false;
  }
  return !/[\u2013\u2014]/.test(text);
}

export function templateNote(p: Settlement["payees"][number]): string {
  return `${p.facts.join(" ")} Total due tonight: ${fmtShort(p.dueCents)}.`;
}

export interface Notes {
  notes: Record<string, string>;
  engine: "model" | "template";
  model?: string;
  rejected: string[];
}

const NotesOut = z.object({ notes: z.record(z.string(), z.string()) });

export async function writeNotes(s: Settlement, showName: string): Promise<Notes> {
  const fallback = Object.fromEntries(s.payees.map((p) => [p.id, templateNote(p)]));
  if (!llmEnabled()) return { notes: fallback, engine: "template", rejected: [] };
  const payload = s.payees.map((p) => ({ id: p.id, name: p.name, role: p.role, deal: p.dealLabel, due: fmtShort(p.dueCents), facts: p.facts }));
  const system = `You are a friendly tour accountant writing a settlement note to each person paid after a concert.
Write 2 or 3 short sentences per payee in plain English: what they earned and why, then the total due.
Use ONLY the dollar figures given in the facts or due fields. Do not do arithmetic. Do not use dashes as punctuation.
Return JSON only: {"notes":{"<id>":"note"}} with one entry per id.`;
  try {
    const { json, model } = await chatJson("notes", system, JSON.stringify({ show: showName, payees: payload }), { maxTokens: 1500 });
    const parsed = NotesOut.parse(json);
    const allowed = allowedFigures(s);
    const notes: Record<string, string> = {};
    const rejected: string[] = [];
    for (const p of s.payees) {
      const n = parsed.notes[p.id] ? tidy(parsed.notes[p.id]).trim() : "";
      if (n && grounded(n, allowed) && n.length < 700) notes[p.id] = n;
      else {
        notes[p.id] = fallback[p.id];
        rejected.push(p.id);
      }
    }
    return { notes, engine: "model", model, rejected };
  } catch {
    return { notes: fallback, engine: "template", rejected: [] };
  }
}

export type PlanStep =
  | { tool: "pay_batch"; payeeIds: string[]; why: string }
  | { tool: "send_invoice"; to: "bar"; why: string }
  | { tool: "hold"; payeeId: string; why: string };

export interface Plan {
  steps: PlanStep[];
  summary: string;
  engine: "model" | "rules";
  model?: string;
  rejected: string[];
}

export function rulePlan(s: Settlement, policy: PolicyResult): Plan {
  const steps: PlanStep[] = [];
  if (policy.payable.length) {
    steps.push({
      tool: "pay_batch",
      payeeIds: policy.payable.map((p) => p.payeeId),
      why: `Pay ${policy.payable.length} people ${fmtShort(policy.totalCents)} in one PayPal Payouts batch.`,
    });
  }
  for (const h of policy.held) steps.push({ tool: "hold", payeeId: h.payeeId, why: `Held: ${h.reason}.` });
  if (s.barInvoice) {
    steps.push({ tool: "send_invoice", to: "bar", why: `Invoice ${s.barInvoice.venueName} ${fmtShort(s.barInvoice.amountCents)} for the bar split.` });
  }
  const summary = `Settle ${fmtShort(policy.totalCents)} to ${policy.payable.length} payees${policy.held.length ? `, hold ${policy.held.length}` : ""}${s.barInvoice ? `, and invoice the bar split` : ""}. ${policy.approvalsNeeded === 2 ? "Needs two approvals." : "Needs one approval."}`;
  return { steps, summary, engine: "rules", rejected: [] };
}

const PlanOut = z.object({
  summary: z.string(),
  steps: z.array(
    z.object({ tool: z.string(), payeeIds: z.array(z.string()).optional(), payeeId: z.string().optional(), to: z.string().optional(), why: z.string().default("") }),
  ),
});

/** Validate a model plan against the policy. Amounts never come from the model. */
export function checkPlan(raw: unknown, s: Settlement, policy: PolicyResult): { steps: PlanStep[]; rejected: string[]; summary: string } {
  const parsed = PlanOut.parse(raw);
  const payable = new Set(policy.payable.map((p) => p.payeeId));
  const known = new Set(s.payees.map((p) => p.id));
  const allowed = allowedFigures(s);
  allowed.add(fmt(policy.totalCents));
  allowed.add(fmtShort(policy.totalCents));
  const rejected: string[] = [];
  const steps: PlanStep[] = [];
  const paid = new Set<string>();
  for (const st of parsed.steps) {
    const why = tidy(st.why).slice(0, 300);
    if (!grounded(why, allowed)) {
      rejected.push(`${st.tool}: invented a dollar figure`);
      continue;
    }
    if (st.tool === "pay_batch") {
      const ids = (st.payeeIds ?? []).filter((id) => {
        if (!payable.has(id)) rejected.push(`pay_batch: ${id} is not payable under policy`);
        return payable.has(id) && !paid.has(id);
      });
      ids.forEach((id) => paid.add(id));
      if (ids.length) steps.push({ tool: "pay_batch", payeeIds: ids, why });
    } else if (st.tool === "hold" && st.payeeId && known.has(st.payeeId)) {
      steps.push({ tool: "hold", payeeId: st.payeeId, why });
    } else if (st.tool === "send_invoice" && s.barInvoice) {
      steps.push({ tool: "send_invoice", to: "bar", why });
    } else {
      rejected.push(`${st.tool}: not an allowed tool or target`);
    }
  }
  const summary = tidy(parsed.summary).slice(0, 400);
  return { steps, rejected, summary: grounded(summary, allowed) ? summary : "" };
}

export async function planPayouts(s: Settlement, policy: PolicyResult): Promise<Plan> {
  const base = rulePlan(s, policy);
  if (!llmEnabled()) return base;
  const system = `You are Settle, a payments agent closing out a concert. Tools you may plan (you do not execute them):
- pay_batch {payeeIds}: one PayPal Payouts batch. Only payees listed as payable.
- hold {payeeId, why}: do not pay tonight.
- send_invoice {to:"bar"}: PayPal invoice to the venue for the promoter's bar split.
Never state an amount that is not given. Return JSON only: {"summary":"one sentence","steps":[{"tool","payeeIds"?,"payeeId"?,"to"?,"why"}]}`;
  const user = JSON.stringify({
    payable: policy.payable.map((p) => ({ id: p.payeeId, name: p.name, amount: fmtShort(p.amountCents) })),
    held: policy.held,
    batchTotal: fmtShort(policy.totalCents),
    approvalsNeeded: policy.approvalsNeeded,
    barInvoice: s.barInvoice ? { venue: s.barInvoice.venueName, amount: fmtShort(s.barInvoice.amountCents) } : null,
  });
  try {
    const { json, model } = await chatJson("plan", system, user, { maxTokens: 900 });
    const checked = checkPlan(json, s, policy);
    const coversAll = policy.payable.every((p) => checked.steps.some((st) => st.tool === "pay_batch" && st.payeeIds.includes(p.payeeId)));
    if (!checked.steps.length || !coversAll) {
      return { ...base, rejected: [...checked.rejected, "model plan did not cover every payable person"] };
    }
    return { steps: checked.steps, summary: checked.summary || base.summary, engine: "model", model, rejected: checked.rejected };
  } catch {
    return base;
  }
}
