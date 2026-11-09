export const maxDuration = 60;
export const preferredRegion = "sfo1";

import { planPayouts, writeNotes } from "@/lib/explain";
import { evaluate } from "@/lib/policy";
import { limited, tooMany } from "@/lib/ratelimit";
import { readShow, verifyPayPalOrders } from "@/lib/server";
import { settle } from "@/lib/settle";

export async function POST(req: Request) {
  if (limited(req, "settle", 20, 10 * 60_000)) return tooMany();
  const input = await readShow(req);
  if (input instanceof Response) return input;
  const started = Date.now();
  const trace: { step: string; detail: string; ms: number }[] = [];
  const mark = (step: string, detail: string) => trace.push({ step, detail, ms: Date.now() - started });

  const { show, checks } = await verifyPayPalOrders(input.show);
  mark("reconcile", `Checked ${checks.length} PayPal orders with the Orders API; ${checks.filter((c) => !c.ok).length} dropped.`);
  const settlement = settle(show);
  mark("compute", `Applied ${show.acts.length} deals and ${show.staff.length} day rates in code. ${settlement.ticketsSold} paid tickets.`);
  const policy = evaluate(settlement, show.policy, show.name);
  mark("policy", `${policy.payable.length} payable, ${policy.held.length} held, ${policy.approvalsNeeded} approval(s) needed.`);
  const [notes, plan] = await Promise.all([writeNotes(settlement, show.name), planPayouts(settlement, policy)]);
  mark("notes", notes.engine === "model" ? `Model wrote notes (${notes.rejected.length} rejected for ungrounded numbers).` : "Template notes.");
  mark("plan", plan.engine === "model" ? `Model planned ${plan.steps.length} steps; guardrails rejected ${plan.rejected.length}.` : "Rule plan.");
  return Response.json({ settlement, policy, notes, plan, verification: checks, trace });
}
