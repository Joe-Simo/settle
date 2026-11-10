import { createHash, randomBytes } from "node:crypto";
import type { PayPalGateway, PayoutBatch } from "./types";
import { PayPalError } from "./types";

/**
 * MOCK PayPal. Used only when no sandbox credentials are configured, and labeled as mock everywhere in the UI.
 * It is stateless (ids carry their own data) so it behaves the same across serverless instances.
 * Response shapes and status names follow the real Orders and Payouts APIs.
 */

const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
const dec = <T>(s: string): T => {
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as T;
  } catch {
    throw new PayPalError("Resource not found (mock)", 404, "RESOURCE_NOT_FOUND");
  }
};
const short = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12).toUpperCase();

type MockBatch = { t: number; i: [string, string, number][] };

export function batchStatusAt(batch: MockBatch, now: number): PayoutBatch["status"] {
  const age = now - batch.t;
  if (age < 3000) return "PENDING";
  if (age < 7000) return "PROCESSING";
  return "SUCCESS";
}

export function mockGateway(now: () => number = Date.now): PayPalGateway {
  function readBatch(batchId: string): PayoutBatch {
    if (!batchId.startsWith("MOCK-BATCH-")) throw new PayPalError("Batch not found (mock)", 404, "RESOURCE_NOT_FOUND");
    const b = dec<MockBatch>(batchId.slice("MOCK-BATCH-".length));
    const status = batchStatusAt(b, now());
    const age = now() - b.t;
    return {
      batchId,
      status,
      items: b.i.map(([senderItemId, receiver, amountCents], idx) => {
        const settled = status === "SUCCESS" || (status === "PROCESSING" && age > 3000 + idx * 600);
        const itemStatus = !settled ? (status === "PENDING" ? "PENDING" : "PENDING") : receiver.includes("unclaimed") ? "UNCLAIMED" : "SUCCESS";
        return {
          senderItemId,
          receiver,
          amountCents,
          status: itemStatus,
          transactionId: settled ? `MOCKTX${short(batchId + senderItemId)}` : undefined,
          payoutItemId: `MOCKITEM${short(senderItemId + batchId)}`,
        };
      }),
    };
  }

  return {
    mode: "mock",
    async createOrder({ amountCents }) {
      return { id: `MOCK-ORD-${enc({ a: amountCents, t: now(), r: randomBytes(3).toString("hex") })}`, status: "CREATED", amountCents };
    },
    async captureOrder(orderId) {
      if (!orderId.startsWith("MOCK-ORD-")) throw new PayPalError("Order not found (mock)", 404, "RESOURCE_NOT_FOUND");
      const o = dec<{ a: number }>(orderId.slice("MOCK-ORD-".length));
      return { id: orderId, status: "COMPLETED", amountCents: o.a, captureId: `MOCKCAP${short(orderId)}`, payerEmail: "buyer@mock.example.com" };
    },
    async approveWithTestCard(orderId) {
      if (!orderId.startsWith("MOCK-ORD-")) throw new PayPalError("Order not found (mock)", 404, "RESOURCE_NOT_FOUND");
      const o = dec<{ a: number }>(orderId.slice("MOCK-ORD-".length));
      return { id: orderId, status: "APPROVED", amountCents: o.a };
    },
    async getOrder(orderId) {
      return this.captureOrder(orderId);
    },
    async createPayoutBatch({ items }) {
      const id = `MOCK-BATCH-${enc({ t: now(), i: items.map((i) => [i.senderItemId, i.receiver, i.amountCents]) } satisfies MockBatch)}`;
      return readBatch(id);
    },
    async getPayoutBatch(batchId) {
      return readBatch(batchId);
    },
    async createAndSendInvoice(input) {
      return { id: `MOCK-INV-${short(input.recipientEmail + now())}`, status: "SENT", number: `MOCK-${String(now()).slice(-6)}` };
    },
    async refundCapture(captureId) {
      return { id: `MOCKREF${short(captureId)}`, status: "COMPLETED" };
    },
  };
}
