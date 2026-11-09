import { approvalsValid, evaluate } from "@/lib/policy";
import { getGateway } from "@/lib/paypal";
import { limited, tooMany } from "@/lib/ratelimit";
import { paypalErrorResponse, readShow, verifyPayPalOrders } from "@/lib/server";
import { settle } from "@/lib/settle";

/**
 * Approve and pay. The server recomputes the settlement and the policy from scratch, so the browser
 * cannot change an amount. Then one PayPal Payouts batch pays every payable person.
 */
export async function POST(req: Request) {
  if (limited(req, "payouts", 8, 10 * 60_000)) return tooMany();
  const input = await readShow(req);
  if (input instanceof Response) return input;
  const approvers = Array.isArray(input.body.approvers) ? input.body.approvers.map(String).slice(0, 4) : [];
  const { show } = await verifyPayPalOrders(input.show);
  const settlement = settle(show);
  const policy = evaluate(settlement, show.policy, show.name);
  if (policy.blocked) {
    return Response.json({ error: "Policy blocked this payout.", checks: policy.checks.filter((c) => !c.ok) }, { status: 409 });
  }
  const ok = approvalsValid(policy.approvalsNeeded, approvers);
  if (!ok.ok) return Response.json({ error: ok.reason }, { status: 403 });
  try {
    const batch = await getGateway().createPayoutBatch({
      senderBatchId: policy.senderBatchId,
      subject: `Your settlement for ${show.name}`,
      message: `Settled by Settle. Approved by ${approvers.filter(Boolean).join(" and ")}.`,
      items: policy.payable.map((p) => ({ senderItemId: p.payeeId, receiver: p.receiver, amountCents: p.amountCents, note: p.note })),
    });
    return Response.json({ batch, senderBatchId: policy.senderBatchId, totalCents: policy.totalCents, held: policy.held });
  } catch (e) {
    return paypalErrorResponse(e);
  }
}
