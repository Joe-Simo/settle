// All money is integer cents. Never use floats for balances.

export type Cents = number;

export function toCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

/** Percentage of an amount in cents, rounded half away from zero to the cent. */
export function pctOf(amount: Cents, pct: number): Cents {
  const raw = (amount * pct) / 100;
  return raw < 0 ? -Math.round(-raw) : Math.round(raw);
}

export function sum(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}

export function fmt(cents: Cents): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}$${dollars.toLocaleString("en-US")}.${rest}`;
}

/** Whole dollars when there are no cents ("$1,200"), else full ("$1,200.50"). */
export function fmtShort(cents: Cents): string {
  return cents % 100 === 0 ? fmt(cents).replace(/\.00$/, "") : fmt(cents);
}

/** PayPal wants "1234.50" strings. */
export function toPayPalValue(cents: Cents): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Invalid amount: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function fromPayPalValue(value: string): Cents {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error(`Invalid PayPal amount: ${value}`);
  const [whole, frac = ""] = value.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
