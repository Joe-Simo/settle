import { describe, expect, it, vi } from "vitest";
import { mockGateway } from "@/lib/paypal/mock";
import { sandboxGateway } from "@/lib/paypal/sandbox";

describe("mock gateway", () => {
  it("is stateless: a fresh instance can read a batch by id and statuses advance", async () => {
    let t = 1_000_000;
    const g = mockGateway(() => t);
    const b = await g.createPayoutBatch({
      senderBatchId: "x",
      subject: "s",
      message: "m",
      items: [
        { senderItemId: "a", receiver: "a@example.com", amountCents: 100, note: "n" },
        { senderItemId: "b", receiver: "b-unclaimed@example.com", amountCents: 200, note: "n" },
      ],
    });
    expect(b.status).toBe("PENDING");
    t += 10_000;
    const later = await mockGateway(() => t).getPayoutBatch(b.batchId);
    expect(later.status).toBe("SUCCESS");
    expect(later.items.map((i) => i.status)).toEqual(["SUCCESS", "UNCLAIMED"]);
    expect(later.items[0].transactionId).toMatch(/^MOCKTX/);
  });

  it("creates and captures orders with the right amount", async () => {
    const g = mockGateway();
    const o = await g.createOrder({ amountCents: 4400, description: "2 x Advance", referenceId: "r" });
    const c = await g.captureOrder(o.id);
    expect(c).toMatchObject({ status: "COMPLETED", amountCents: 4400 });
    await expect(g.captureOrder("NOPE")).rejects.toThrow();
  });
});

describe("sandbox gateway", () => {
  function fakeFetch(routes: Record<string, unknown>) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      const key = Object.keys(routes).find((k) => u.includes(k));
      return new Response(JSON.stringify(key ? routes[key] : {}), { status: key ? 200 : 404 });
    });
    return { f: f as unknown as typeof fetch, calls };
  }

  it("approves an order with the sandbox test card through confirm-payment-source", async () => {
    const { f, calls } = fakeFetch({
      "/v1/oauth2/token": { access_token: "tok", expires_in: 3600 },
      "/confirm-payment-source": { id: "O1", status: "APPROVED", purchase_units: [{ amount: { value: "44.00" } }] },
    });
    const o = await sandboxGateway("id", "secret", f).approveWithTestCard("O1");
    expect(o).toMatchObject({ id: "O1", status: "APPROVED", amountCents: 4400 });
    expect(calls[1].url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/O1/confirm-payment-source");
    expect(JSON.parse(String(calls[1].init?.body)).payment_source.card.number).toBe("4032039317984658");
  });

  it("authenticates once, then creates a payout batch in PayPal's format", async () => {
    const { f, calls } = fakeFetch({
      "/v1/oauth2/token": { access_token: "tok", expires_in: 3600 },
      "/v1/payments/payouts": { batch_header: { payout_batch_id: "B1", batch_status: "PENDING" } },
    });
    const g = sandboxGateway("id", "secret", f);
    const b = await g.createPayoutBatch({ senderBatchId: "settle-1", subject: "s", message: "m", items: [{ senderItemId: "a", receiver: "a@example.com", amountCents: 627300, note: "n" }] });
    await g.createPayoutBatch({ senderBatchId: "settle-2", subject: "s", message: "m", items: [{ senderItemId: "a", receiver: "a@example.com", amountCents: 1, note: "n" }] });
    expect(b.batchId).toBe("B1");
    expect(calls.filter((c) => c.url.includes("oauth2")).length).toBe(1);
    expect(calls[0].url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    const body = JSON.parse(String(calls[1].init?.body));
    expect(body.sender_batch_header.sender_batch_id).toBe("settle-1");
    expect(body.items[0]).toMatchObject({ recipient_type: "EMAIL", amount: { value: "6273.00", currency: "USD" }, sender_item_id: "a" });
    expect((calls[1].init?.headers as Record<string, string>)["PayPal-Request-Id"]).toBeTruthy();
  });

  it("reads captured order amounts and payer", async () => {
    const { f } = fakeFetch({
      "/v1/oauth2/token": { access_token: "tok", expires_in: 3600 },
      "/v2/checkout/orders/O1": {
        id: "O1",
        status: "COMPLETED",
        payer: { email_address: "buyer@personal.example.com" },
        purchase_units: [{ amount: { value: "44.00" }, payments: { captures: [{ id: "C1", amount: { value: "44.00" } }] } }],
      },
    });
    const o = await sandboxGateway("id", "s", f).getOrder("O1");
    expect(o).toEqual({ id: "O1", status: "COMPLETED", amountCents: 4400, captureId: "C1", payerEmail: "buyer@personal.example.com" });
  });

  it("surfaces PayPal error names and details", async () => {
    const f = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("oauth2")
        ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
        : new Response(JSON.stringify({ name: "INSUFFICIENT_FUNDS", message: "Sender does not have sufficient funds.", details: [{ issue: "INSUFFICIENT_FUNDS" }] }), { status: 422 }),
    ) as unknown as typeof fetch;
    await expect(
      sandboxGateway("id", "s", f).createPayoutBatch({ senderBatchId: "x", subject: "s", message: "m", items: [{ senderItemId: "a", receiver: "a@example.com", amountCents: 1, note: "n" }] }),
    ).rejects.toThrow(/sufficient funds/);
  });
});
