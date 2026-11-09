"use client";

import { Activity, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DealStep } from "@/components/steps/deal-step";
import { NightStep } from "@/components/steps/night-step";
import { PayStep } from "@/components/steps/pay-step";
import { SettleStep } from "@/components/steps/settle-step";
import { api, type InvoiceInfo, type LogEntry, type PayoutBatch, type SettleResult, type Status } from "@/components/types";
import { cn, Pill } from "@/components/ui";
import { demoShow } from "@/lib/demo";
import { Show } from "@/lib/schema";

const KEY = "settle:show:v1";
const STEPS = [
  { id: "deal", label: "1. Deal" },
  { id: "night", label: "2. Night of" },
  { id: "settle", label: "3. Settle" },
  { id: "pay", label: "4. Pay" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

export function Dashboard() {
  const [show, setShowState] = useState<Show>(() => demoShow());
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<StepId>("deal");
  const [result, setResult] = useState<SettleResult | null>(null);
  const [settledFor, setSettledFor] = useState("");
  const [batch, setBatch] = useState<PayoutBatch | null>(null);
  const [invoice, setInvoice] = useState<InvoiceInfo | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = Show.safeParse(JSON.parse(raw));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.success) setShowState(parsed.data);
      }
    } catch {
      /* ignore */
    }
    api<Status>("/api/status").then(setStatus).catch(() => setStatus({ paypal: "mock", clientId: null, ai: "off", model: null }));
  }, []);

  const setShow = useCallback((s: Show) => {
    setShowState(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, []);

  const log = useCallback((text: string, tone: LogEntry["tone"] = "info") => {
    setEntries((e) => [{ at: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }), text, tone }, ...e].slice(0, 80));
  }, []);

  const fingerprint = useMemo(() => JSON.stringify(show), [show]);
  const stale = !!result && settledFor !== fingerprint;
  const setResultTracked = useCallback(
    (r: SettleResult | null) => {
      setResult(r);
      setSettledFor(fingerprint);
      setBatch(null);
      setInvoice(null);
    },
    [fingerprint],
  );

  function reset() {
    localStorage.removeItem(KEY);
    setShowState(demoShow());
    setResult(null);
    setBatch(null);
    setInvoice(null);
    setEntries([]);
    setStep("deal");
  }

  const common = { show, setShow, status, log };
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="rounded bg-amber px-2 py-0.5 font-black tracking-tight text-amber-ink">SETTLE</span>
          <span className="hidden text-sm text-dim sm:inline">pay the band before the van pulls out</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Pill tone={status?.paypal === "sandbox" ? "pp" : "hold"}>{status ? (status.paypal === "sandbox" ? "PayPal: sandbox" : "PayPal: MOCK (no sandbox keys)") : "PayPal: ..."}</Pill>
          <Pill tone={status?.ai === "live" ? "amber" : "dim"}>{status ? (status.ai === "live" ? `AI: ${status.model}` : status.ai === "resting" ? "AI: daily quota used, using fallbacks" : "AI: off, using fallbacks") : "AI: ..."}</Pill>
          <button onClick={reset} className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-dim hover:text-ink">
            <RotateCcw size={12} /> Reset demo
          </button>
        </div>
      </header>
      <div className="marquee no-print mb-4 rounded-xl border border-line bg-panel px-4 py-3">
        <div className="text-xs uppercase tracking-[0.2em] text-amber">Tonight</div>
        <div className="text-xl font-bold">{show.name}</div>
        <div className="text-sm text-dim">
          {show.venue}, {show.city} · {new Date(`${show.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · doors {show.doors} · capacity {show.capacity}
        </div>
      </div>
      <nav className="no-print mb-4 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={cn("rounded-md border px-4 py-2 text-sm font-semibold", step === s.id ? "border-amber bg-amber/10 text-amber" : "border-line text-dim hover:text-ink")}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main>
          {step === "deal" && <DealStep {...common} />}
          {step === "night" && <NightStep {...common} />}
          {step === "settle" && <SettleStep {...common} result={result} setResult={setResultTracked} stale={stale} />}
          {step === "pay" && <PayStep {...common} result={result} stale={stale} batch={batch} setBatch={setBatch} invoice={invoice} setInvoice={setInvoice} />}
        </main>
        <aside className="no-print rounded-xl border border-line bg-panel p-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-dim">
            <Activity size={14} /> Agent activity
          </h3>
          {entries.length === 0 && <p className="text-xs text-dim">Every agent step, PayPal call and approval shows up here.</p>}
          <ol className="space-y-2">
            {entries.map((e, i) => (
              <li key={i} className="text-xs leading-snug">
                <span className="font-mono text-dim">{e.at}</span>{" "}
                <span className={cn(e.tone === "go" && "text-go", e.tone === "hold" && "text-hold", e.tone === "pp" && "text-pp")}>{e.text}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
