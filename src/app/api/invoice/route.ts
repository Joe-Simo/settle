import { fmtShort } from "@/lib/money";
import { getGateway } from "@/lib/paypal";
import { limited, tooMany } from "@/lib/ratelimit";
import { paypalErrorResponse, readShow } from "@/lib/server";
import { settle } from "@/lib/settle";

/** Send the venue a PayPal invoice for the promoter's share of the bar. The amount is recomputed here. */
export async function POST(req: Request) {
  if (limited(req, "invoice", 6, 10 * 60_000)) return tooMany();
  const input = await readShow(req);
  if (input instanceof Response) return input;
  const s = settle(input.show);
  if (!s.barInvoice) return Response.json({ error: "No bar split is owed for this show." }, { status: 409 });
  try {
    const inv = await getGateway().createAndSendInvoice({
      invoicerName: "Northside Presents",
      recipientName: s.barInvoice.venueName,
      recipientEmail: s.barInvoice.venueEmail,
      itemName: `Bar split, ${input.show.name} (${input.show.date})`,
      amountCents: s.barInvoice.amountCents,
      note: `Per the room agreement: ${s.barInvoice.formula} = ${fmtShort(s.barInvoice.amountCents)}.`,
    });
    return Response.json({ invoice: inv, amountCents: s.barInvoice.amountCents });
  } catch (e) {
    return paypalErrorResponse(e);
  }
}
