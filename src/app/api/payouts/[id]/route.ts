import { getGateway } from "@/lib/paypal";
import { paypalErrorResponse } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_=-]{5,2000}$/.test(id)) return Response.json({ error: "Bad batch id." }, { status: 400 });
  try {
    return Response.json(await getGateway().getPayoutBatch(id));
  } catch (e) {
    return paypalErrorResponse(e);
  }
}
