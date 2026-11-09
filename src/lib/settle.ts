import { type Cents, fmtShort, pctOf, sum } from "./money";
import type { Act, Show } from "./schema";

/**
 * The settlement engine. Pure, deterministic TypeScript: the language model never does money math.
 * Every number it produces carries a human readable formula so the sheet can show its work.
 */

export interface Line {
  label: string;
  amountCents: Cents;
  formula: string;
}

export type Outcome = "flat" | "guarantee" | "backend" | "door";

export interface PayeeResult {
  id: string;
  kind: "act" | "staff";
  name: string;
  role: string;
  email: string;
  dealLabel: string;
  earnedCents: Cents;
  bonusCents: Cents;
  merchNetCents: Cents;
  depositCents: Cents;
  dueCents: Cents;
  /** If a deposit was larger than what was earned, the act owes this back. */
  owesBackCents: Cents;
  outcome: Outcome;
  lines: Line[];
  /** Plain facts, already true, used as the template explanation and as the grounding set for the AI. */
  facts: string[];
}

export interface Settlement {
  showId: string;
  ticketsSold: number;
  comps: number;
  capacity: number;
  refunds: number;
  refundedCents: Cents;
  grossCents: Cents;
  verifiedGrossCents: Cents;
  declaredGrossCents: Cents;
  taxCents: Cents;
  adjustedGrossCents: Cents;
  showExpensesCents: Cents;
  staffCents: Cents;
  talentCents: Cents;
  venueMerchCents: Cents;
  barInvoice: null | { venueName: string; venueEmail: string; amountCents: Cents; formula: string };
  promoterNetCents: Cents;
  payees: PayeeResult[];
  totalDueCents: Cents;
  waterfall: { label: string; amountCents: Cents }[];
}

export function dealLabel(act: Act): string {
  const d = act.deal;
  const g = fmtShort(d.guaranteeCents);
  switch (d.type) {
    case "flat":
      return `${g} flat`;
    case "versus":
      return `${g} vs ${d.backendPct}% of ${d.basis}`;
    case "plus":
      return `${g} plus ${d.backendPct}% after split`;
    case "door":
      return `${d.backendPct}% of door`;
  }
}

function bonusFor(act: Act, ticketsSold: number): { cents: Cents; lines: Line[] } {
  const reached = act.deal.bonuses.filter((b) => ticketsSold >= b.ticketsAtLeast);
  return {
    cents: sum(reached.map((b) => b.amountCents)),
    lines: reached.map((b) => ({
      label: `Bonus at ${b.ticketsAtLeast} tickets`,
      amountCents: b.amountCents,
      formula: `${ticketsSold} paid tickets >= ${b.ticketsAtLeast}`,
    })),
  };
}

const ORDER: Record<Act["billing"], number> = { opener: 0, support: 1, headliner: 2 };

export function settle(show: Show): Settlement {
  const done = show.orders.filter((o) => o.status === "COMPLETED");
  const refundedOrders = show.orders.filter((o) => o.status === "REFUNDED");
  const ticketsSold = sum(done.map((o) => o.qty));
  const grossCents = sum(done.map((o) => o.amountCents));
  const verifiedGrossCents = sum(done.filter((o) => o.source === "paypal").map((o) => o.amountCents));
  const declaredGrossCents = grossCents - verifiedGrossCents;
  // Ticket prices include tax: tax = gross - gross / (1 + rate).
  const taxCents = show.taxPct > 0 ? grossCents - Math.round(grossCents / (1 + show.taxPct / 100)) : 0;
  const adjustedGrossCents = grossCents - taxCents;
  const showExpensesCents = sum(show.expenses.map((e) => e.amountCents));
  const staffCents = sum(show.staff.map((s) => s.flatCents));

  const acts = [...show.acts].sort((a, b) => ORDER[a.billing] - ORDER[b.billing]);
  const earnedSoFar: Cents[] = [];
  const payees: PayeeResult[] = [];
  let venueMerchCents = 0;

  for (const act of acts) {
    const d = act.deal;
    const lines: Line[] = [];
    const facts: string[] = [];
    let earned: Cents;
    let outcome: Outcome;
    const priorTalent = sum(earnedSoFar);

    if (d.type === "flat") {
      earned = d.guaranteeCents;
      outcome = "flat";
      lines.push({ label: "Flat guarantee", amountCents: earned, formula: "per deal" });
      facts.push(`The deal is a ${fmtShort(d.guaranteeCents)} flat fee, so ticket sales do not change it.`);
    } else if (d.type === "door") {
      earned = pctOf(adjustedGrossCents, d.backendPct);
      outcome = "door";
      lines.push({
        label: `${d.backendPct}% of adjusted gross`,
        amountCents: earned,
        formula: `${d.backendPct}% x ${fmtShort(adjustedGrossCents)}`,
      });
      facts.push(`The deal is ${d.backendPct}% of the door. The adjusted gross was ${fmtShort(adjustedGrossCents)}, so the share is ${fmtShort(earned)}.`);
    } else {
      const rawExpenses = showExpensesCents + staffCents + priorTalent;
      const expenseBase = d.expenseCapCents !== undefined ? Math.min(rawExpenses, d.expenseCapCents) : rawExpenses;
      const capped = expenseBase < rawExpenses;
      const expenseFormula = capped
        ? `${fmtShort(rawExpenses)} actual, capped at ${fmtShort(expenseBase)}`
        : `show ${fmtShort(showExpensesCents)} + staff ${fmtShort(staffCents)} + support ${fmtShort(priorTalent)}`;
      lines.push({ label: "Expenses charged", amountCents: expenseBase, formula: expenseFormula });

      if (d.type === "versus") {
        const base = d.basis === "net" ? Math.max(0, adjustedGrossCents - expenseBase) : adjustedGrossCents;
        const backend = pctOf(base, d.backendPct);
        lines.push({
          label: d.basis === "net" ? "Net after expenses" : "Adjusted gross",
          amountCents: base,
          formula: d.basis === "net" ? `${fmtShort(adjustedGrossCents)} - ${fmtShort(expenseBase)}` : "gross less tax",
        });
        lines.push({ label: `${d.backendPct}% backend`, amountCents: backend, formula: `${d.backendPct}% x ${fmtShort(base)}` });
        lines.push({ label: "Guarantee", amountCents: d.guaranteeCents, formula: "per deal" });
        if (backend > d.guaranteeCents) {
          earned = backend;
          outcome = "backend";
          facts.push(
            `${d.backendPct}% of the ${d.basis === "net" ? "net" : "gross"} came to ${fmtShort(backend)}, which beat the ${fmtShort(d.guaranteeCents)} guarantee by ${fmtShort(backend - d.guaranteeCents)}, so the backend applies.`,
          );
        } else {
          earned = d.guaranteeCents;
          outcome = "guarantee";
          facts.push(
            `${d.backendPct}% of the ${d.basis === "net" ? "net" : "gross"} came to ${fmtShort(backend)}, which is under the ${fmtShort(d.guaranteeCents)} guarantee, so the guarantee applies.`,
          );
        }
      } else {
        const base = expenseBase + d.guaranteeCents;
        const profit = pctOf(base, d.promoterProfitPct);
        const splitPoint = base + profit;
        const over = Math.max(0, adjustedGrossCents - splitPoint);
        const backend = pctOf(over, d.backendPct);
        lines.push({
          label: "Split point",
          amountCents: splitPoint,
          formula: `expenses + guarantee + ${d.promoterProfitPct}% promoter profit (${fmtShort(profit)})`,
        });
        lines.push({ label: "Over split point", amountCents: over, formula: `${fmtShort(adjustedGrossCents)} - ${fmtShort(splitPoint)}, floor 0` });
        lines.push({ label: "Guarantee", amountCents: d.guaranteeCents, formula: "per deal" });
        lines.push({ label: `${d.backendPct}% of overage`, amountCents: backend, formula: `${d.backendPct}% x ${fmtShort(over)}` });
        earned = d.guaranteeCents + backend;
        outcome = backend > 0 ? "backend" : "guarantee";
        facts.push(
          over > 0
            ? `The show cleared the ${fmtShort(splitPoint)} split point by ${fmtShort(over)}, so ${d.backendPct}% of that (${fmtShort(backend)}) is added to the ${fmtShort(d.guaranteeCents)} guarantee.`
            : `The show did not clear the ${fmtShort(splitPoint)} split point, so only the ${fmtShort(d.guaranteeCents)} guarantee is due.`,
        );
      }
      if (capped) facts.push(`Expenses were capped at ${fmtShort(expenseBase)} as agreed in the deal.`);
    }

    const bonus = bonusFor(act, ticketsSold);
    lines.push(...bonus.lines);
    if (bonus.cents > 0) facts.push(`${ticketsSold} paid tickets unlocked ${fmtShort(bonus.cents)} in bonuses.`);
    earnedSoFar.push(earned + bonus.cents);

    const venueMerch = pctOf(act.merchGrossCents, d.merchVenuePct);
    const merchNet = act.merchGrossCents - venueMerch;
    venueMerchCents += venueMerch;
    if (act.merchGrossCents > 0) {
      lines.push({
        label: "Merch (net of venue cut)",
        amountCents: merchNet,
        formula: `${fmtShort(act.merchGrossCents)} - ${d.merchVenuePct}% venue`,
      });
      facts.push(`Merch sold ${fmtShort(act.merchGrossCents)}; after the ${d.merchVenuePct}% venue cut the act keeps ${fmtShort(merchNet)}.`);
    }
    if (d.depositPaidCents > 0) {
      lines.push({ label: "Deposit already paid", amountCents: -d.depositPaidCents, formula: "paid before show day" });
      facts.push(`A ${fmtShort(d.depositPaidCents)} deposit was already paid and is subtracted.`);
    }
    const gross = earned + bonus.cents + merchNet - d.depositPaidCents;
    payees.push({
      id: act.id,
      kind: "act",
      name: act.name,
      role: act.billing,
      email: act.email,
      dealLabel: dealLabel(act),
      earnedCents: earned,
      bonusCents: bonus.cents,
      merchNetCents: merchNet,
      depositCents: d.depositPaidCents,
      dueCents: Math.max(0, gross),
      owesBackCents: Math.max(0, -gross),
      outcome,
      lines,
      facts,
    });
  }

  for (const s of show.staff) {
    payees.push({
      id: s.id,
      kind: "staff",
      name: s.name,
      role: s.role,
      email: s.email,
      dealLabel: `${fmtShort(s.flatCents)} flat`,
      earnedCents: s.flatCents,
      bonusCents: 0,
      merchNetCents: 0,
      depositCents: 0,
      dueCents: s.flatCents,
      owesBackCents: 0,
      outcome: "flat",
      lines: [{ label: "Day rate", amountCents: s.flatCents, formula: "per agreement" }],
      facts: [`${s.role} day rate of ${fmtShort(s.flatCents)}.`],
    });
  }

  let barInvoice: Settlement["barInvoice"] = null;
  if (show.barSplit) {
    const b = show.barSplit;
    const over = Math.max(0, b.barGrossCents - b.thresholdCents);
    const amount = pctOf(over, b.promoterPct);
    if (amount > 0) {
      barInvoice = {
        venueName: b.venueName,
        venueEmail: b.venueEmail,
        amountCents: amount,
        formula: `${b.promoterPct}% x (${fmtShort(b.barGrossCents)} bar - ${fmtShort(b.thresholdCents)} threshold)`,
      };
    }
  }

  const talentCents = sum(earnedSoFar);
  const promoterNetCents =
    adjustedGrossCents - showExpensesCents - staffCents - talentCents + venueMerchCents + (barInvoice?.amountCents ?? 0);
  const totalDueCents = sum(payees.map((p) => p.dueCents));

  return {
    showId: show.id,
    ticketsSold,
    comps: show.comps,
    capacity: show.capacity,
    refunds: sum(refundedOrders.map((o) => o.qty)),
    refundedCents: sum(refundedOrders.map((o) => o.amountCents)),
    grossCents,
    verifiedGrossCents,
    declaredGrossCents,
    taxCents,
    adjustedGrossCents,
    showExpensesCents,
    staffCents,
    talentCents,
    venueMerchCents,
    barInvoice,
    promoterNetCents,
    payees,
    totalDueCents,
    waterfall: [
      { label: "Gross", amountCents: grossCents },
      { label: "Tax", amountCents: -taxCents },
      { label: "Expenses", amountCents: -showExpensesCents },
      { label: "Staff", amountCents: -staffCents },
      { label: "Talent", amountCents: -talentCents },
      { label: "Venue merch", amountCents: venueMerchCents },
      { label: "Bar split", amountCents: barInvoice?.amountCents ?? 0 },
      { label: "Promoter net", amountCents: promoterNetCents },
    ],
  };
}
