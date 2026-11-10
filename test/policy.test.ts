import { describe, expect, it } from "vitest";
import { demoOrders, DEMO_INPUT, demoShow } from "@/lib/demo";
import { approvalsValid, batchIdFor, evaluate } from "@/lib/policy";
import { Show } from "@/lib/schema";
import { settle } from "@/lib/settle";

describe("policy", () => {
  const show = demoShow();
  const s = settle(show);

  it("allows the demo batch and asks for two approvals", () => {
    const r = evaluate(s, show.policy);
    expect(r.blocked).toBe(false);
    expect(r.payable).toHaveLength(6);
    expect(r.totalCents).toBe(748300);
    expect(r.approvalsNeeded).toBe(2);
    expect(r.senderBatchId).toMatch(/^settle-foundry-1107-[0-9a-f]{16}$/);
  });

  it("gives each demo session its own sender_batch_id, stable for retries", () => {
    const a = evaluate(s, show.policy, "x", "run-a").senderBatchId;
    expect(evaluate(s, show.policy, "x", "run-a").senderBatchId).toBe(a);
    expect(evaluate(s, show.policy, "x", "run-b").senderBatchId).not.toBe(a);
    expect(a).not.toBe(evaluate(s, show.policy).senderBatchId);
  });

  it("holds anyone over the per-payee cap", () => {
    const r = evaluate(s, { ...show.policy, perPayeeCapCents: 500000 });
    expect(r.held.map((h) => h.payeeId)).toContain("marlowe");
    expect(r.payable.map((p) => p.payeeId)).not.toContain("marlowe");
  });

  it("holds payees without an email", () => {
    const noEmail = Show.parse({ ...DEMO_INPUT, orders: demoOrders(), acts: DEMO_INPUT.acts.map((a) => (a.id === "velvet" ? { ...a, email: "" } : a)) });
    const r = evaluate(settle(noEmail), noEmail.policy);
    expect(r.held.find((h) => h.payeeId === "velvet")?.reason).toMatch(/email/);
  });

  it("blocks a batch that pays the same email twice", () => {
    const dupe = Show.parse({ ...DEMO_INPUT, orders: demoOrders(), staff: DEMO_INPUT.staff!.map((x) => ({ ...x, email: "same@example.com" })) });
    expect(evaluate(settle(dupe), dupe.policy).blocked).toBe(true);
  });

  it("blocks paying out more than was collected", () => {
    const tiny = Show.parse({ ...DEMO_INPUT, orders: demoOrders().slice(0, 3) });
    const r = evaluate(settle(tiny), tiny.policy);
    expect(r.checks.find((c) => c.id === "funds")?.ok).toBe(false);
    expect(r.blocked).toBe(true);
  });

  it("makes the batch id stable for the same items and different for changes", () => {
    const a = evaluate(s, show.policy).payable;
    expect(batchIdFor("x", a)).toBe(batchIdFor("x", a));
    expect(batchIdFor("x", a)).not.toBe(batchIdFor("x", [{ ...a[0], amountCents: 1 }, ...a.slice(1)]));
  });

  it("requires distinct approvers", () => {
    expect(approvalsValid(2, ["Sam", " sam "]).ok).toBe(false);
    expect(approvalsValid(2, ["Sam", "Dana"]).ok).toBe(true);
    expect(approvalsValid(1, [""]).ok).toBe(false);
  });
});
