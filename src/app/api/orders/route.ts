import { DEMO_INPUT } from "@/lib/demo";
import { getGateway } from "@/lib/paypal";
import { limited, tooMany } from "@/lib/ratelimit";
import { paypalErrorResponse } from "@/lib/server";

/** Create a PayPal order for tickets. The price comes from the server, never from the browser. */
export async function POST(req: Request) {
  if (limited(req, "orders", 30, 10 * 60_000)) return tooMany();
  const body = (await req.json().catch(() => null)) as { tierId?: unknown; qty?: unknown } | null;
  const tier = DEMO_INPUT.tiers.find((t) => t.id === body?.tierId);
  const qty = Number(body?.qty);
  if (!tier || !Number.isInteger(qty) || qty < 1 || qty > 6) {
    return Response.json({ error: "Pick a ticket type and 1 to 6 tickets." }, { status: 400 });
  }
  try {
    const order = await getGateway().createOrder({
      amountCents: tier.priceCents * qty,
      description: `${qty} x ${tier.name}, ${DEMO_INPUT.name}`,
      referenceId: `${DEMO_INPUT.id}:${tier.id}:${qty}`,
    });
    return Response.json({ id: order.id, status: order.status, amountCents: tier.priceCents * qty, tierId: tier.id, qty });
  } catch (e) {
    return paypalErrorResponse(e);
  }
}
