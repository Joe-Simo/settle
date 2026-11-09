import { getGateway, PayPalError } from "./paypal";
import { Show, type Order } from "./schema";

/** Parse a show from a request body. Returns a 400 response on bad input. */
export async function readShow(req: Request): Promise<{ show: Show; body: Record<string, unknown> } | Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const parsed = Show.safeParse(body.show);
  if (!parsed.success) {
    return Response.json({ error: "That show is not valid.", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  if (parsed.data.orders.length > 5000) return Response.json({ error: "Too many orders for the demo." }, { status: 400 });
  return { show: parsed.data, body };
}

export interface Verification {
  orderId: string;
  paypalOrderId: string;
  ok: boolean;
  detail: string;
}

/**
 * Reconcile: every order that claims to be a PayPal order is checked against the PayPal Orders API.
 * Orders that are not COMPLETED or whose amount differs are dropped from the settlement.
 */
export async function verifyPayPalOrders(show: Show): Promise<{ show: Show; checks: Verification[] }> {
  const gateway = getGateway();
  const claimed = show.orders.filter((o) => o.source === "paypal" && o.status === "COMPLETED").slice(0, 50);
  const checks: Verification[] = [];
  const bad = new Set<string>();
  await Promise.all(
    claimed.map(async (o) => {
      if (!o.paypalOrderId) {
        bad.add(o.id);
        checks.push({ orderId: o.id, paypalOrderId: "", ok: false, detail: "No PayPal order id." });
        return;
      }
      try {
        const real = await gateway.getOrder(o.paypalOrderId);
        const ok = real.status === "COMPLETED" && real.amountCents === o.amountCents;
        if (!ok) bad.add(o.id);
        checks.push({
          orderId: o.id,
          paypalOrderId: o.paypalOrderId,
          ok,
          detail: ok ? `COMPLETED, ${(real.amountCents / 100).toFixed(2)} USD` : `PayPal says ${real.status}, ${(real.amountCents / 100).toFixed(2)} USD`,
        });
      } catch (e) {
        bad.add(o.id);
        checks.push({ orderId: o.id, paypalOrderId: o.paypalOrderId, ok: false, detail: e instanceof PayPalError ? e.message : "Lookup failed." });
      }
    }),
  );
  const orders: Order[] = show.orders.filter((o) => !bad.has(o.id) && !(o.source === "paypal" && o.status === "COMPLETED" && !claimed.includes(o)));
  return { show: { ...show, orders }, checks };
}

export function paypalErrorResponse(e: unknown) {
  if (e instanceof PayPalError) {
    return Response.json({ error: e.message, name: e.name_, debugId: e.debugId }, { status: e.status >= 400 && e.status < 600 ? e.status : 502 });
  }
  return Response.json({ error: "PayPal request failed." }, { status: 502 });
}
