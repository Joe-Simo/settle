import { describe, expect, it } from "vitest";
import { demoShow, DEMO_INPUT, demoOrders } from "@/lib/demo";
import { fmt, fmtShort, fromPayPalValue, pctOf, toPayPalValue } from "@/lib/money";
import { Show, type ShowInput } from "@/lib/schema";
import { settle } from "@/lib/settle";

const mk = (patch: Partial<ShowInput>) => Show.parse({ ...DEMO_INPUT, orders: demoOrders(), ...patch });

describe("money", () => {
  it("formats and converts cents", () => {
    expect(fmt(123456)).toBe("$1,234.56");
    expect(fmt(-500)).toBe("-$5.00");
    expect(fmtShort(150000)).toBe("$1,500");
    expect(toPayPalValue(627300)).toBe("6273.00");
    expect(toPayPalValue(5)).toBe("0.05");
    expect(fromPayPalValue("6273.5")).toBe(627350);
    expect(() => toPayPalValue(-1)).toThrow();
    expect(() => fromPayPalValue("12,00")).toThrow();
  });
  it("rounds percentages half away from zero", () => {
    expect(pctOf(101, 50)).toBe(51);
    expect(pctOf(-101, 50)).toBe(-51);
  });
});

describe("settle: demo show", () => {
  const s = settle(demoShow());
  const by = (id: string) => s.payees.find((p) => p.id === id)!;

  it("counts tickets and ignores refunds", () => {
    expect(s.ticketsSold).toBe(380);
    expect(s.refunds).toBe(2);
    expect(s.grossCents).toBe(908000);
    expect(s.declaredGrossCents).toBe(908000);
    expect(s.verifiedGrossCents).toBe(0);
  });

  it("pays the opener flat plus the 350 ticket bonus", () => {
    expect(by("june").earnedCents).toBe(15000);
    expect(by("june").bonusCents).toBe(10000);
    expect(by("june").dueCents).toBe(25000);
  });

  it("applies the headliner versus deal with the expense cap, bonus, merch and deposit", () => {
    const m = by("marlowe");
    expect(m.outcome).toBe("backend");
    expect(m.lines[0]).toMatchObject({ label: "Expenses charged", amountCents: 320000 });
    expect(m.earnedCents).toBe(470400);
    expect(m.bonusCents).toBe(25000);
    expect(m.merchNetCents).toBe(181900);
    expect(m.dueCents).toBe(627300);
    expect(m.facts.join(" ")).toContain("beat the $1,500 guarantee");
  });

  it("totals the night and the bar split", () => {
    expect(s.talentCents).toBe(560400);
    expect(s.barInvoice?.amountCents).toBe(24000);
    expect(s.promoterNetCents).toBe(109700);
    expect(s.totalDueCents).toBe(748300);
    expect(s.payees).toHaveLength(6);
  });
});

describe("settle: deal types", () => {
  const head = DEMO_INPUT.acts[0];
  const withDeal = (deal: object, orders = demoOrders()) =>
    settle(mk({ acts: [{ ...head, merchGrossCents: 0, deal: deal as never }], staff: [], expenses: [{ id: "x", label: "All", amountCents: 300000 }], orders }));

  it("versus falls back to the guarantee on a soft night", () => {
    const soft = demoOrders().slice(0, 20);
    const r = withDeal({ type: "versus", guaranteeCents: 150000, backendPct: 80 }, soft).payees[0];
    expect(r.outcome).toBe("guarantee");
    expect(r.dueCents).toBe(150000);
  });

  it("versus on gross ignores expenses", () => {
    const r = withDeal({ type: "versus", guaranteeCents: 100000, backendPct: 50, basis: "gross" }).payees[0];
    expect(r.earnedCents).toBe(454000);
  });

  it("plus deal pays guarantee plus a share past the split point", () => {
    // split = 300000 + 100000 + 15% of 400000 = 460000; over = 908000 - 460000 = 448000; 85% = 380800
    const r = withDeal({ type: "plus", guaranteeCents: 100000, backendPct: 85, promoterProfitPct: 15 }).payees[0];
    expect(r.earnedCents).toBe(480800);
    expect(r.outcome).toBe("backend");
  });

  it("door deal is a straight percentage", () => {
    const r = withDeal({ type: "door", guaranteeCents: 0, backendPct: 70 }).payees[0];
    expect(r.earnedCents).toBe(635600);
  });

  it("an oversized deposit becomes money owed back, never a negative payout", () => {
    const r = withDeal({ type: "flat", guaranteeCents: 10000, depositPaidCents: 30000 }).payees[0];
    expect(r.dueCents).toBe(0);
    expect(r.owesBackCents).toBe(20000);
  });

  it("backs tax out of tax-inclusive ticket prices", () => {
    const s = settle(mk({ taxPct: 10 }));
    expect(s.taxCents).toBe(908000 - Math.round(908000 / 1.1));
    expect(s.adjustedGrossCents).toBe(Math.round(908000 / 1.1));
  });

  it("counts verified PayPal orders separately from declared sales", () => {
    const orders = [
      ...demoOrders(),
      { id: "PP-1", source: "paypal" as const, tierId: "adv", qty: 2, amountCents: 4400, status: "COMPLETED" as const, at: "2026-11-01T00:00:00Z", paypalOrderId: "X" },
    ];
    const s = settle(mk({ orders }));
    expect(s.verifiedGrossCents).toBe(4400);
    expect(s.ticketsSold).toBe(382);
  });
});

describe("chart data", async () => {
  const { waterfallRows, salesByDay } = await import("@/lib/chart-data");
  it("builds a waterfall that ends at promoter net and never floats below zero", () => {
    const rows = waterfallRows(settle(demoShow()));
    expect(rows[0]).toMatchObject({ label: "Gross", total: 9080 });
    expect(rows.at(-1)).toMatchObject({ label: "Promoter net", total: 1097 });
    expect(rows.every((r) => r.base >= 0)).toBe(true);
    const talent = rows.find((r) => r.label === "Talent")!;
    expect(talent.down).toBe(5604);
  });
  it("buckets completed sales by day", () => {
    const days = salesByDay(demoOrders());
    expect(days.reduce((a, d) => a + d.adv + d.door + d.paypal, 0)).toBe(380);
  });
});
