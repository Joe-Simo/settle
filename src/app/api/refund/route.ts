import { getGateway } from "@/lib/paypal";
import { limited, tooMany } from "@/lib/ratelimit";
import { paypalErrorResponse } from "@/lib/server";

/** Refund a ticket that was paid with PayPal. The order then drops out of the settlement. */
export async function POST(req: Request) {
  if (limited(req, "refund", 10, 10 * 60_000)) return tooMany();
  const body = (await req.json().catch(() => null)) as { captureId?: unknown } | null;
  const id = typeof body?.captureId === "string" ? body.captureId : "";
  if (!/^[A-Za-z0-9_-]{5,100}$/.test(id)) return Response.json({ error: "Bad capture id." }, { status: 400 });
  try {
    return Response.json(await getGateway().refundCapture(id));
  } catch (e) {
    return paypalErrorResponse(e);
  }
}
