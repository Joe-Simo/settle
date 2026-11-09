import { getGateway } from "@/lib/paypal";
import { limited, tooMany } from "@/lib/ratelimit";
import { paypalErrorResponse } from "@/lib/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (limited(req, "capture", 30, 10 * 60_000)) return tooMany();
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{5,400}$/.test(id)) return Response.json({ error: "Bad order id." }, { status: 400 });
  try {
    const o = await getGateway().captureOrder(id);
    return Response.json(o);
  } catch (e) {
    return paypalErrorResponse(e);
  }
}
