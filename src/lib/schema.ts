import { z } from "zod";

const cents = z.number().int().nonnegative();
const pct = z.number().min(0).max(100);
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const email = z.string().regex(EMAIL_RE, "Not a valid email");

/**
 * Deal types used in live music:
 * - flat: a fixed fee.
 * - versus: guarantee versus a percentage, whichever is greater.
 * - plus: guarantee plus a percentage of what is left after the split point.
 * - door: a percentage of the door, no guarantee.
 */
export const DealType = z.enum(["flat", "versus", "plus", "door"]);
export type DealType = z.infer<typeof DealType>;

export const Bonus = z.object({
  ticketsAtLeast: z.number().int().positive(),
  amountCents: cents,
});

export const Deal = z.object({
  type: DealType,
  guaranteeCents: cents,
  backendPct: pct.default(0),
  /** "net" = after show expenses, "gross" = adjusted gross. */
  basis: z.enum(["net", "gross"]).default("net"),
  /** Plus deals: promoter profit, as a percent of (expenses + guarantee), sits in the split point. */
  promoterProfitPct: pct.default(15),
  /** Most expenses the act agreed can be charged against their backend. */
  expenseCapCents: cents.optional(),
  bonuses: z.array(Bonus).default([]),
  /** Venue keeps this share of the act's merch gross (soft goods). */
  merchVenuePct: pct.default(0),
  /** Already paid before show day. */
  depositPaidCents: cents.default(0),
});
export type Deal = z.infer<typeof Deal>;

export const Act = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  billing: z.enum(["headliner", "support", "opener"]),
  email,
  deal: Deal,
  merchGrossCents: cents.default(0),
  /** Exact quotes from the deal memo that back each term, keyed by term name. */
  sources: z.record(z.string(), z.string()).default({}),
});
export type Act = z.infer<typeof Act>;

export const Staff = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  email,
  flatCents: cents,
});
export type Staff = z.infer<typeof Staff>;

export const Expense = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amountCents: cents,
});
export type Expense = z.infer<typeof Expense>;

export const TicketTier = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceCents: cents,
});
export type TicketTier = z.infer<typeof TicketTier>;

export const Order = z.object({
  id: z.string().min(1),
  /** paypal = a real Checkout order (verified with the Orders API); boxoffice = cash at the door, declared by the promoter; simulated = labeled demo crowd. */
  source: z.enum(["paypal", "boxoffice", "simulated"]),
  tierId: z.string().min(1),
  qty: z.number().int().positive(),
  amountCents: cents,
  status: z.enum(["COMPLETED", "REFUNDED"]),
  at: z.string(),
  paypalOrderId: z.string().optional(),
  captureId: z.string().optional(),
  buyer: z.string().optional(),
});
export type Order = z.infer<typeof Order>;

export const BarSplit = z.object({
  venueName: z.string().min(1),
  venueEmail: email,
  barGrossCents: cents,
  thresholdCents: cents,
  promoterPct: pct,
});
export type BarSplit = z.infer<typeof BarSplit>;

export const Policy = z.object({
  perPayeeCapCents: cents,
  dualApprovalOverCents: cents,
});
export type Policy = z.infer<typeof Policy>;

export const Show = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  venue: z.string().min(1),
  city: z.string().min(1),
  date: z.string().min(1),
  doors: z.string().default("8:00 PM"),
  capacity: z.number().int().positive(),
  taxPct: pct.default(0),
  comps: z.number().int().nonnegative().default(0),
  tiers: z.array(TicketTier).min(1),
  expenses: z.array(Expense).default([]),
  acts: z.array(Act).min(1),
  staff: z.array(Staff).default([]),
  barSplit: BarSplit.optional(),
  policy: Policy,
  memo: z.string().default(""),
  orders: z.array(Order).default([]),
});
export type Show = z.infer<typeof Show>;
export type ShowInput = z.input<typeof Show>;
