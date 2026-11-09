import { randomUUID } from "node:crypto";
import { fromPayPalValue, toPayPalValue } from "../money";
import { type InvoiceInfo, type OrderInfo, type PayPalGateway, type PayoutBatch, PayPalError } from "./types";

/** Real PayPal REST calls against the sandbox. Never used with live credentials. */

const BASE = "https://api-m.sandbox.paypal.com";

type Json = Record<string, unknown>;

export function sandboxGateway(clientId: string, clientSecret: string, fetchImpl: typeof fetch = fetch): PayPalGateway {
  let token: { value: string; expires: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.expires > Date.now() + 60_000) return token.value;
    const res = await fetchImpl(`${BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const body = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) throw new PayPalError(`PayPal auth failed (${res.status})`, res.status, "AUTH");
    token = { value: String(body.access_token), expires: Date.now() + Number(body.expires_in ?? 300) * 1000 };
    return token.value;
  }

  async function call<T = Json>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
    const res = await fetchImpl(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
        ...(method === "POST" ? { "PayPal-Request-Id": extra["PayPal-Request-Id"] ?? randomUUID() } : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = (text ? JSON.parse(text) : {}) as Json;
    if (!res.ok) {
      const details = Array.isArray(json.details) ? (json.details as Json[]).map((d) => d.issue ?? d.description).join(", ") : "";
      throw new PayPalError(
        `${String(json.message ?? json.name ?? "PayPal error")}${details ? `: ${details}` : ""}`,
        res.status,
        String(json.name ?? "PAYPAL_ERROR"),
        json.debug_id ? String(json.debug_id) : undefined,
      );
    }
    return json as T;
  }

  function orderInfo(o: Json): OrderInfo {
    const pu = (o.purchase_units as Json[] | undefined)?.[0] ?? {};
    const capture = ((pu.payments as Json | undefined)?.captures as Json[] | undefined)?.[0];
    const amount = (capture?.amount ?? pu.amount) as Json | undefined;
    return {
      id: String(o.id),
      status: String(o.status),
      amountCents: amount?.value ? fromPayPalValue(String(amount.value)) : 0,
      captureId: capture?.id ? String(capture.id) : undefined,
      payerEmail: (o.payer as Json | undefined)?.email_address as string | undefined,
    };
  }

  function batchInfo(b: Json): PayoutBatch {
    const header = (b.batch_header ?? {}) as Json;
    const items = ((b.items as Json[] | undefined) ?? []).map((i) => {
      const item = (i.payout_item ?? {}) as Json;
      const amount = (item.amount ?? {}) as Json;
      return {
        senderItemId: String(item.sender_item_id ?? ""),
        receiver: String(item.receiver ?? ""),
        amountCents: amount.value ? fromPayPalValue(String(amount.value)) : 0,
        status: String(i.transaction_status ?? "PENDING"),
        transactionId: i.transaction_id ? String(i.transaction_id) : undefined,
        payoutItemId: i.payout_item_id ? String(i.payout_item_id) : undefined,
      };
    });
    return { batchId: String(header.payout_batch_id), status: String(header.batch_status), items };
  }

  return {
    mode: "sandbox",
    async createOrder({ amountCents, description, referenceId }) {
      const o = await call("POST", "/v2/checkout/orders", {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: referenceId.slice(0, 256),
            description: description.slice(0, 127),
            amount: { currency_code: "USD", value: toPayPalValue(amountCents) },
          },
        ],
      });
      return orderInfo(o);
    },
    async captureOrder(orderId) {
      return orderInfo(await call("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}));
    },
    async getOrder(orderId) {
      return orderInfo(await call("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`));
    },
    async createPayoutBatch({ senderBatchId, subject, message, items }) {
      const b = await call("POST", "/v1/payments/payouts", {
        sender_batch_header: { sender_batch_id: senderBatchId, email_subject: subject, email_message: message },
        items: items.map((i) => ({
          recipient_type: "EMAIL",
          amount: { value: toPayPalValue(i.amountCents), currency: "USD" },
          note: i.note,
          sender_item_id: i.senderItemId,
          receiver: i.receiver,
        })),
      });
      const info = batchInfo(b);
      return { ...info, items: info.items.length ? info.items : items.map((i) => ({ ...i, status: "PENDING" })) };
    },
    async getPayoutBatch(batchId) {
      return batchInfo(await call("GET", `/v1/payments/payouts/${encodeURIComponent(batchId)}?fields=batch_header,items&page_size=100`));
    },
    async createAndSendInvoice(input): Promise<InvoiceInfo> {
      const inv = await call(
        "POST",
        "/v2/invoicing/invoices",
        {
          detail: { currency_code: "USD", note: input.note.slice(0, 4000), payment_term: { term_type: "DUE_ON_RECEIPT" } },
          invoicer: { business_name: input.invoicerName },
          primary_recipients: [{ billing_info: { business_name: input.recipientName, email_address: input.recipientEmail } }],
          items: [
            {
              name: input.itemName.slice(0, 200),
              quantity: "1",
              unit_amount: { currency_code: "USD", value: toPayPalValue(input.amountCents) },
            },
          ],
        },
        { Prefer: "return=representation" },
      );
      const id = String(inv.id);
      const sent = await call<Json>("POST", `/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
        send_to_invoicer: false,
        send_to_recipient: true,
      });
      const after = await call<Json>("GET", `/v2/invoicing/invoices/${encodeURIComponent(id)}`);
      const links = (after.links as Json[] | undefined) ?? [];
      const payerView = links.find((l) => l.rel === "payer-view")?.href ?? sent.href;
      return {
        id,
        status: String(after.status ?? "SENT"),
        number: (after.detail as Json | undefined)?.invoice_number as string | undefined,
        payerViewUrl: payerView ? String(payerView) : undefined,
      };
    },
    async refundCapture(captureId) {
      const r = await call("POST", `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {});
      return { id: String(r.id), status: String(r.status) };
    },
  };
}
