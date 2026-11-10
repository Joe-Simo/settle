import { getGateway } from "@/lib/paypal";
import { limited, tooMany } from "@/lib/ratelimit";
import { paypalErrorResponse } from "@/lib/server";

/**
 * Approve a ticket order with a PayPal sandbox test card, so judges can buy without a sandbox login.
 * The order is then captured by the normal capture route. Sandbox and mock only; live PayPal is never used.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (limited(req, "testcard", 20, 10 * 60_000)) return tooMany();
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{5,400}$/.test(id)) return Response.json({ error: "Bad order id." }, { status: 400 });
  try {
    const o = await getGateway().approveWithTestCard(id);
    return Response.json({ id: o.id, status: o.status });
  } catch (e) {
    return paypalErrorResponse(e);
  }
}
