import type { Plan, Notes } from "@/lib/explain";
import type { ExtractResult } from "@/lib/extract";
import type { PayoutBatch, InvoiceInfo } from "@/lib/paypal/types";
import type { PolicyResult } from "@/lib/policy";
import type { Show } from "@/lib/schema";
import type { Settlement } from "@/lib/settle";

export interface Status {
  paypal: "sandbox" | "mock";
  clientId: string | null;
  ai: "live" | "resting" | "off";
  model: string | null;
}

export interface SettleResult {
  settlement: Settlement;
  policy: PolicyResult;
  notes: Notes;
  plan: Plan;
  verification: { orderId: string; paypalOrderId: string; ok: boolean; detail: string }[];
  trace: { step: string; detail: string; ms: number }[];
}

export interface LogEntry {
  at: string;
  text: string;
  tone: "info" | "go" | "hold" | "pp";
}

export interface StepProps {
  show: Show;
  setShow: (s: Show) => void;
  status: Status | null;
  log: (text: string, tone?: LogEntry["tone"]) => void;
}

export type { ExtractResult, PayoutBatch, InvoiceInfo };

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; issues?: string[] };
  if (!res.ok) throw new Error([json.error ?? `Request failed (${res.status})`, ...(json.issues ?? [])].join(" "));
  return json;
}
