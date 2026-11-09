import type { Order } from "./schema";
import type { Settlement } from "./settle";

export interface WaterfallRow {
  label: string;
  base: number;
  up: number;
  down: number;
  total: number;
}

/** Waterfall rows for stacked bars: an invisible base plus an up, down or total segment, in dollars. */
export function waterfallRows(s: Settlement): WaterfallRow[] {
  const steps = s.waterfall.filter((w, i) => i === 0 || i === s.waterfall.length - 1 || w.amountCents !== 0);
  const rows: WaterfallRow[] = [];
  let running = 0;
  steps.forEach((w, i) => {
    const v = w.amountCents / 100;
    if (i === 0 || i === steps.length - 1) {
      running = v;
      rows.push({ label: w.label, base: 0, up: 0, down: 0, total: v });
      return;
    }
    const base = v >= 0 ? running : running + v;
    running += v;
    rows.push({ label: w.label, base, up: v > 0 ? v : 0, down: v < 0 ? -v : 0, total: 0 });
  });
  return rows;
}

export function salesByDay(orders: Order[]) {
  const done = orders.filter((o) => o.status === "COMPLETED").sort((a, b) => a.at.localeCompare(b.at));
  const byDay = new Map<string, { adv: number; door: number; paypal: number }>();
  for (const o of done) {
    const day = o.at.slice(0, 10);
    const row = byDay.get(day) ?? { adv: 0, door: 0, paypal: 0 };
    if (o.source === "paypal") row.paypal += o.qty;
    else if (o.tierId === "door") row.door += o.qty;
    else row.adv += o.qty;
    byDay.set(day, row);
  }
  return [...byDay.entries()].map(([day, r]) => ({ day: new Date(`${day}T12:00:00Z`), ...r }));
}
