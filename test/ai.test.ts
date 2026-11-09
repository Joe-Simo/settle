import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_MEMO, demoShow } from "@/lib/demo";
import { checkPlan, grounded, allowedFigures, planPayouts, rulePlan, writeNotes } from "@/lib/explain";
import { dollarFigures, extractDeal, extractWithRules, verify } from "@/lib/extract";
import { tidy } from "@/lib/llm";
import { evaluate } from "@/lib/policy";
import { settle } from "@/lib/settle";

describe("rule extraction of the demo memo", () => {
  const acts = extractWithRules(DEMO_MEMO);
  const by = (n: string) => acts.find((a) => a.name === n)!;

  it("finds three acts with billing", () => {
    expect(acts.map((a) => [a.name, a.billing])).toEqual([
      ["Marlowe Kid", "headliner"],
      ["Velvet Static", "support"],
      ["June Arbor", "opener"],
    ]);
  });

  it("reads the headliner versus deal fully", () => {
    const d = by("Marlowe Kid").deal;
    expect(d).toMatchObject({ type: "versus", guaranteeCents: 150000, backendPct: 80, basis: "net", expenseCapCents: 320000, merchVenuePct: 15, depositPaidCents: 50000 });
    expect(d.bonuses).toEqual([
      { ticketsAtLeast: 350, amountCents: 25000 },
      { ticketsAtLeast: 450, amountCents: 25000 },
    ]);
    expect(by("Marlowe Kid").warnings).toEqual([]);
  });

  it("reads flat deals and the opener bonus", () => {
    expect(by("Velvet Static").deal).toMatchObject({ type: "flat", guaranteeCents: 40000 });
    expect(by("June Arbor").deal.bonuses).toEqual([{ ticketsAtLeast: 350, amountCents: 10000 }]);
  });

  it("keeps a source quote that is really in the memo", () => {
    expect(DEMO_MEMO.replace(/\s+/g, " ")).toContain(by("Marlowe Kid").sources.guarantee);
  });

  it("reads plus and door phrasing", () => {
    const memo = "Headliner, The Pines: $800 guarantee plus 85% after the split point.\n\nOpener, Moss: 60% of the door.";
    const [a, b] = extractWithRules(memo);
    expect(a.deal).toMatchObject({ type: "plus", guaranteeCents: 80000, backendPct: 85 });
    expect(b.deal).toMatchObject({ type: "door", backendPct: 60, guaranteeCents: 0 });
  });
});

describe("verification of model output", () => {
  it("collects every dollar figure", () => {
    expect([...dollarFigures("a $1,500 b $3,200.50")]).toEqual([150000, 320050]);
  });

  it("flags invented quotes and numbers", () => {
    const w = verify(DEMO_MEMO, {
      name: "Marlowe Kid",
      billing: "headliner",
      deal: { type: "versus", guaranteeCents: 200000, backendPct: 90, basis: "net", promoterProfitPct: 15, bonuses: [], merchVenuePct: 0, depositPaidCents: 0 },
      sources: { guarantee: "A $2,000 guarantee was agreed." },
    });
    expect(w.join(" ")).toMatch(/quote for "guarantee"/);
    expect(w.join(" ")).toMatch(/\$2,000 does not appear/);
    expect(w.join(" ")).toMatch(/90% does not appear/);
  });
});

describe("model calls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("falls back to rules without a key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const r = await extractDeal(DEMO_MEMO);
    expect(r.engine).toBe("rules");
    expect(r.acts).toHaveLength(3);
  });

  it("uses model output and verifies it", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    const content = JSON.stringify({
      acts: [
        { name: "Marlowe Kid", billing: "headliner", type: "versus", guarantee: "1,500", backendPct: 80, basis: "net", expenseCap: 3200, bonuses: [{ ticketsAtLeast: 350, amount: 250 }], merchVenuePct: 15, depositPaid: 500, sources: { guarantee: "Headliner, Marlowe Kid: $1,500 guarantee vs 80% of net after expenses, whichever is greater." } },
      ],
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ model: "m", choices: [{ message: { content: content } }] }))));
    const r = await extractDeal(DEMO_MEMO + " ");
    expect(r.engine).toBe("model");
    expect(r.acts[0].deal.guaranteeCents).toBe(150000);
    expect(r.acts[0].warnings).toEqual([]);
  });

  it("falls back to rules when the model fails", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503 })));
    const r = await extractDeal(DEMO_MEMO + "  ");
    expect(r.engine).toBe("rules");
    expect(r.note).toMatch(/503/);
  });

  it("rejects notes with invented numbers and keeps grounded ones", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    const s = settle(demoShow());
    const content = JSON.stringify({ notes: { marlowe: "Great night! You are owed $9,999.", velvet: "Thanks for a great set. Your $400 flat fee is due tonight." } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))));
    const n = await writeNotes(s, "Test show");
    expect(n.notes.velvet).toContain("$400 flat fee");
    expect(n.notes.marlowe).not.toContain("$9,999");
    expect(n.rejected).toContain("marlowe");
  });
});

describe("agent plan guardrails", () => {
  const show = demoShow();
  const s = settle(show);
  const policy = evaluate(s, { ...show.policy, perPayeeCapCents: 500000 });

  it("rule plan pays the payable, holds the rest, invoices the bar", () => {
    const p = rulePlan(s, policy);
    expect(p.steps.map((x) => x.tool)).toEqual(["pay_batch", "hold", "send_invoice"]);
  });

  it("drops payees the policy did not allow and unknown tools", () => {
    const r = checkPlan(
      {
        summary: "Pay everyone",
        steps: [
          { tool: "pay_batch", payeeIds: ["marlowe", "velvet", "ghost"], why: "Pay them." },
          { tool: "wire_money", why: "Faster." },
          { tool: "send_invoice", to: "bar", why: "Bar split of $240." },
        ],
      },
      s,
      policy,
    );
    expect(r.steps[0]).toMatchObject({ tool: "pay_batch", payeeIds: ["velvet"] });
    expect(r.rejected.join(" ")).toMatch(/marlowe is not payable/);
    expect(r.rejected.join(" ")).toMatch(/wire_money/);
    expect(r.steps.some((x) => x.tool === "send_invoice")).toBe(true);
  });

  it("drops steps that invent dollar figures", () => {
    const r = checkPlan({ summary: "x", steps: [{ tool: "send_invoice", to: "bar", why: "Invoice $5,000." }] }, s, policy);
    expect(r.steps).toEqual([]);
  });

  it("falls back to the rule plan when the model plan misses someone", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    const content = JSON.stringify({ summary: "Pay one", steps: [{ tool: "pay_batch", payeeIds: ["velvet"], why: "ok" }] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))));
    const p = await planPayouts(s, policy);
    expect(p.engine).toBe("rules");
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("grounding accepts computed figures only", () => {
    const allowed = allowedFigures(s);
    expect(grounded("Due $6,273 tonight", allowed)).toBe(true);
    expect(grounded("Due $6,274 tonight", allowed)).toBe(false);
    expect(tidy("a \u2014 b")).toBe("a, b");
  });
});
