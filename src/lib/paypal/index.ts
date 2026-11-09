import { mockGateway } from "./mock";
import { sandboxGateway } from "./sandbox";
import type { PayPalGateway } from "./types";

export * from "./types";

/** Sandbox when credentials exist, otherwise the clearly labeled mock. Live PayPal is never used. */
export function getGateway(): PayPalGateway {
  const id = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (id && secret) return sandboxGateway(id, secret);
  return mockGateway();
}

export function paypalMode(): "sandbox" | "mock" {
  return process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim() ? "sandbox" : "mock";
}

/** The browser needs the client id (public by design) to load the PayPal JS SDK. */
export function publicClientId(): string | null {
  return paypalMode() === "sandbox" ? (process.env.PAYPAL_CLIENT_ID?.trim() ?? null) : null;
}
