import { Show, type ShowInput, type Order } from "./schema";

/**
 * The demo show. Every name here is invented. Ticket sales are a labeled simulated crowd,
 * plus any real PayPal sandbox orders a visitor makes on the ticket page.
 */

export const DEMO_MEMO = `Subject: Confirming Marlowe Kid at The Foundry Hall, Sat Nov 7

Hi Dana,

Confirming the offer for Saturday, November 7 at The Foundry Hall (capacity 450).

Headliner, Marlowe Kid: $1,500 guarantee vs 80% of net after expenses, whichever is greater.
Expenses charged against the band are capped at $3,200. Bonus of $250 at 350 paid tickets and
another $250 at a sellout of 450. The venue keeps 15% of soft merch. A $500 deposit was paid on Oct 1.

Support, Velvet Static: $400 flat.

Opener, June Arbor: $150 flat, plus a $100 bonus if we hit 350 paid tickets.

Please pay everyone by PayPal at the emails on the advance sheet.

Thanks,
Sam (Northside Presents)`;

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** 260 advance tickets at $22 and 120 door tickets at $28, deterministic. */
export function demoOrders(): Order[] {
  const rand = seededRandom(7);
  const orders: Order[] = [];
  const build = (tierId: string, price: number, total: number, source: Order["source"], start: Date, spanHours: number, prefix: string) => {
    let left = total;
    let n = 0;
    while (left > 0) {
      const qty = Math.min(left, 1 + Math.floor(rand() * 4));
      left -= qty;
      n += 1;
      const at = new Date(start.getTime() + rand() * spanHours * 3600_000);
      orders.push({
        id: `${prefix}-${String(n).padStart(3, "0")}`,
        source,
        tierId,
        qty,
        amountCents: price * qty,
        status: "COMPLETED",
        at: at.toISOString(),
      });
    }
  };
  build("adv", 2200, 260, "simulated", new Date("2026-10-08T14:00:00Z"), 30 * 24, "SIM");
  build("door", 2800, 120, "boxoffice", new Date("2026-11-08T01:00:00Z"), 3, "BOX");
  // Two refunds that must not count.
  orders.push({ id: "SIM-R01", source: "simulated", tierId: "adv", qty: 2, amountCents: 4400, status: "REFUNDED", at: "2026-11-02T18:00:00.000Z" });
  orders.sort((a, b) => a.at.localeCompare(b.at));
  return orders;
}

export const DEMO_INPUT: ShowInput = {
  id: "foundry-1107",
  name: "Marlowe Kid with Velvet Static and June Arbor",
  venue: "The Foundry Hall",
  city: "Columbus, OH",
  date: "2026-11-07",
  doors: "8:00 PM",
  capacity: 450,
  taxPct: 0,
  comps: 14,
  tiers: [
    { id: "adv", name: "Advance", priceCents: 2200 },
    { id: "door", name: "Day of show", priceCents: 2800 },
  ],
  expenses: [
    { id: "rent", label: "Room rent", amountCents: 90000 },
    { id: "prod", label: "Sound and lights", amountCents: 65000 },
    { id: "mkt", label: "Marketing", amountCents: 45000 },
    { id: "backline", label: "Backline", amountCents: 20000 },
    { id: "hosp", label: "Hospitality", amountCents: 18000 },
  ],
  acts: [
    {
      id: "marlowe",
      name: "Marlowe Kid",
      billing: "headliner",
      email: "marlowe.kid@example.com",
      merchGrossCents: 214000,
      deal: {
        type: "versus",
        guaranteeCents: 150000,
        backendPct: 80,
        basis: "net",
        expenseCapCents: 320000,
        bonuses: [
          { ticketsAtLeast: 350, amountCents: 25000 },
          { ticketsAtLeast: 450, amountCents: 25000 },
        ],
        merchVenuePct: 15,
        depositPaidCents: 50000,
      },
    },
    {
      id: "velvet",
      name: "Velvet Static",
      billing: "support",
      email: "velvet.static@example.com",
      deal: { type: "flat", guaranteeCents: 40000 },
    },
    {
      id: "june",
      name: "June Arbor",
      billing: "opener",
      email: "june.arbor@example.com",
      deal: { type: "flat", guaranteeCents: 15000, bonuses: [{ ticketsAtLeast: 350, amountCents: 10000 }] },
    },
  ],
  staff: [
    { id: "theo", name: "Theo Park", role: "Sound engineer", email: "theo.sound@example.com", flatCents: 25000 },
    { id: "mo", name: "Mo Reyes", role: "Security", email: "mo.security@example.com", flatCents: 16000 },
    { id: "priya", name: "Priya Shah", role: "Door manager", email: "priya.door@example.com", flatCents: 15000 },
  ],
  barSplit: {
    venueName: "The Foundry Hall",
    venueEmail: "bar@foundry.example.com",
    barGrossCents: 640000,
    thresholdCents: 400000,
    promoterPct: 10,
  },
  policy: { perPayeeCapCents: 750000, dualApprovalOverCents: 250000 },
  memo: DEMO_MEMO,
};

export function demoShow(): Show {
  return Show.parse({ ...DEMO_INPUT, orders: demoOrders() });
}
