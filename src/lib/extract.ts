import { z } from "zod";
import { chatJson, llmEnabled, tidy } from "./llm";
import { toCents } from "./money";
import { type Act, Deal, DealType } from "./schema";

/**
 * Deal memo extraction. The model reads a free text offer or email and returns structured deal terms,
 * each with the exact quote it came from. We then verify every quote is really in the memo and every
 * dollar figure really appears in it. Anything that fails is flagged for the promoter, never trusted silently.
 */

export interface ExtractedAct {
  name: string;
  billing: Act["billing"];
  deal: Deal;
  sources: Record<string, string>;
  warnings: string[];
}

export interface ExtractResult {
  acts: ExtractedAct[];
  engine: "model" | "rules";
  model?: string;
  note?: string;
}

const num = z.union([z.number(), z.string()]).transform((v) => (typeof v === "number" ? v : Number(String(v).replace(/[$,%\s]/g, ""))));
const optNum = z.union([num, z.null()]).optional();

const ModelAct = z.object({
  name: z.string().min(1),
  billing: z.enum(["headliner", "support", "opener"]).catch("support"),
  type: DealType.catch("flat"),
  guarantee: optNum,
  backendPct: optNum,
  basis: z.enum(["net", "gross"]).catch("net").optional(),
  expenseCap: optNum,
  bonuses: z.array(z.object({ ticketsAtLeast: num, amount: num })).catch([]).optional(),
  merchVenuePct: optNum,
  depositPaid: optNum,
  sources: z.record(z.string(), z.string()).catch({}).optional(),
});
const ModelOut = z.object({ acts: z.array(ModelAct).min(1) });

const norm = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();

/** Every dollar figure written in the memo, in cents. */
export function dollarFigures(memo: string): Set<number> {
  const out = new Set<number>();
  for (const m of memo.matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g)) out.add(toCents(Number(m[1].replace(/,/g, ""))));
  return out;
}

export function verify(memo: string, act: Omit<ExtractedAct, "warnings">): string[] {
  const warnings: string[] = [];
  const body = norm(memo);
  for (const [term, quote] of Object.entries(act.sources)) {
    if (quote && !body.includes(norm(quote))) warnings.push(`The quote for "${term}" is not in the memo. Check it.`);
  }
  const figures = dollarFigures(memo);
  const check = (label: string, cents: number | undefined) => {
    if (cents && !figures.has(cents)) warnings.push(`${label} of $${(cents / 100).toLocaleString("en-US")} does not appear in the memo.`);
  };
  check("Guarantee", act.deal.guaranteeCents);
  check("Expense cap", act.deal.expenseCapCents);
  check("Deposit", act.deal.depositPaidCents);
  act.deal.bonuses.forEach((b) => check("Bonus", b.amountCents));
  if (act.deal.type !== "flat" && act.deal.backendPct > 0 && !body.includes(`${act.deal.backendPct}%`)) {
    warnings.push(`${act.deal.backendPct}% does not appear in the memo.`);
  }
  return warnings;
}

const money = (s: string) => toCents(Number(s.replace(/,/g, "")));

/** Deterministic fallback for common memo phrasing. Used when no model is available or the model fails. */
export function extractWithRules(memo: string): ExtractedAct[] {
  const acts: ExtractedAct[] = [];
  const re = /(headliner|support|opener)\s*[,:-]\s*([^:\n]+?)\s*:\s*([\s\S]*?)(?=\n\s*\n|\n\s*(?:headliner|support|opener)\b|$)/gi;
  for (const m of memo.matchAll(re)) {
    const billing = m[1].toLowerCase() as Act["billing"];
    const name = m[2].trim();
    const text = m[3].replace(/\s+/g, " ").trim();
    const sentences = text.split(/(?<=\.)\s+/);
    const find = (r: RegExp) => sentences.find((s) => r.test(s));
    const sources: Record<string, string> = {};

    let type: Deal["type"] = "flat";
    let backendPct = 0;
    let basis: Deal["basis"] = "net";
    const g = text.match(/\$([\d,]+)\s*(?:guarantee|flat)/i);
    const vs = text.match(/vs\.?\s*(\d{1,3})%\s*of\s*(net|gross)/i);
    const plus = text.match(/plus\s*(\d{1,3})%/i);
    const door = text.match(/(\d{1,3})%\s*of\s*(?:the\s*)?door/i);
    if (vs) {
      type = "versus";
      backendPct = Number(vs[1]);
      basis = vs[2].toLowerCase() as Deal["basis"];
      sources.backend = find(/vs\.?\s*\d/i) ?? "";
    } else if (plus) {
      type = "plus";
      backendPct = Number(plus[1]);
      sources.backend = find(/plus\s*\d{1,3}%/i) ?? "";
    } else if (door) {
      type = "door";
      backendPct = Number(door[1]);
      sources.backend = find(/of\s*(?:the\s*)?door/i) ?? "";
    }
    if (g) sources.guarantee = find(/\$[\d,]+\s*(?:guarantee|flat)/i) ?? "";

    const cap = text.match(/capped at \$([\d,]+)/i);
    if (cap) sources.expenseCap = find(/capped at/i) ?? "";
    const bonuses: Deal["bonuses"] = [];
    for (const s of sentences.filter((x) => /bonus|sellout/i.test(x))) {
      for (const b of s.matchAll(/\$([\d,]+)[^$]*?(?:at|hit|reach|reaching)\s*(?:a sellout of\s*)?(\d{2,5})/gi)) {
        bonuses.push({ ticketsAtLeast: Number(b[2]), amountCents: money(b[1]) });
      }
      sources.bonuses = s;
    }
    const merch = text.match(/keeps?\s*(\d{1,3})%\s*of\s*(?:soft\s*)?merch/i);
    if (merch) sources.merch = find(/merch/i) ?? "";
    const dep = text.match(/\$([\d,]+)\s*deposit/i);
    if (dep) sources.deposit = find(/deposit/i) ?? "";

    const deal = Deal.parse({
      type,
      guaranteeCents: g ? money(g[1]) : 0,
      backendPct,
      basis,
      expenseCapCents: cap ? money(cap[1]) : undefined,
      bonuses,
      merchVenuePct: merch ? Number(merch[1]) : 0,
      depositPaidCents: dep ? money(dep[1]) : 0,
    });
    const act = { name, billing, deal, sources: Object.fromEntries(Object.entries(sources).filter(([, v]) => v)) };
    acts.push({ ...act, warnings: verify(memo, act) });
  }
  return acts;
}

const SYSTEM = `You extract live music deal terms from a promoter's offer or confirmation email.
Return JSON only: {"acts":[{"name","billing":"headliner|support|opener","type":"flat|versus|plus|door","guarantee":dollars,"backendPct":number,"basis":"net|gross","expenseCap":dollars or null,"bonuses":[{"ticketsAtLeast":n,"amount":dollars}],"merchVenuePct":number,"depositPaid":dollars,"sources":{"guarantee":"exact quote","backend":"exact quote","expenseCap":"exact quote","bonuses":"exact quote","merch":"exact quote","deposit":"exact quote"}}]}
Rules: "versus" means guarantee vs a percentage, whichever is greater. "plus" means guarantee plus a percentage after the split point. "door" means a percentage of the door with no guarantee. "flat" is a fixed fee.
Every source must be copied word for word from the email. Leave a term out (or 0) if the email does not state it. Never invent numbers. Do not compute payouts.`;

export async function extractDeal(memo: string): Promise<ExtractResult> {
  const text = memo.slice(0, 6000);
  if (llmEnabled()) {
    try {
      const { json, model } = await chatJson("extract", SYSTEM, text, { maxTokens: 1500 });
      const parsed = ModelOut.parse(json);
      const acts = parsed.acts.map((a) => {
        const deal = Deal.parse({
          type: a.type,
          guaranteeCents: toCents(a.guarantee ?? 0),
          backendPct: a.backendPct ?? 0,
          basis: a.basis ?? "net",
          expenseCapCents: a.expenseCap ? toCents(a.expenseCap) : undefined,
          bonuses: (a.bonuses ?? []).map((b) => ({ ticketsAtLeast: Math.round(b.ticketsAtLeast), amountCents: toCents(b.amount) })),
          merchVenuePct: a.merchVenuePct ?? 0,
          depositPaidCents: toCents(a.depositPaid ?? 0),
        });
        const sources = Object.fromEntries(Object.entries(a.sources ?? {}).filter(([, v]) => v).map(([k, v]) => [k, tidy(v)]));
        const act = { name: tidy(a.name), billing: a.billing, deal, sources };
        return { ...act, warnings: verify(memo, act) };
      });
      return { acts, engine: "model", model };
    } catch (e) {
      return { acts: extractWithRules(memo), engine: "rules", note: `Model unavailable (${(e as Error).message}); used the rule parser.` };
    }
  }
  return { acts: extractWithRules(memo), engine: "rules", note: "No model key configured; used the rule parser." };
}
