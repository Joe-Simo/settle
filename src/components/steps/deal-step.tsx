"use client";

import type { ColDef } from "ag-grid-community";
import { CheckCircle2, FileText, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Grid } from "@/components/grid";
import { api, type ExtractResult, type StepProps } from "@/components/types";
import { Button, Card, Pill } from "@/components/ui";
import { fmtShort, toCents } from "@/lib/money";
import type { Act } from "@/lib/schema";
import { dealLabel } from "@/lib/settle";

const dollars = (c?: number) => (c === undefined ? "" : fmtShort(c));

export function DealStep({ show, setShow, log }: StepProps) {
  const [memo, setMemo] = useState(show.memo);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState("");

  async function read() {
    setBusy(true);
    setError("");
    log("Agent: reading the deal memo");
    try {
      const r = await api<ExtractResult>("/api/extract", { memo });
      setResult(r);
      const warn = r.acts.reduce((a, x) => a + x.warnings.length, 0);
      log(`Agent: extracted ${r.acts.length} deals with ${r.engine === "model" ? r.model : "the rule parser"}; ${warn} warning(s)`, warn ? "hold" : "go");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!result) return;
    const acts: Act[] = result.acts.map((x, i) => {
      const prev = show.acts.find((a) => a.name.toLowerCase() === x.name.toLowerCase());
      return {
        id: prev?.id ?? `act-${i}-${x.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: x.name,
        billing: x.billing,
        email: prev?.email ?? "",
        merchGrossCents: prev?.merchGrossCents ?? 0,
        deal: x.deal,
        sources: x.sources,
      };
    });
    setShow({ ...show, memo, acts });
    log(`Promoter confirmed ${acts.length} deals from the memo`, "go");
  }

  const cols: ColDef<Act>[] = [
    { headerName: "Act", field: "name", pinned: "left", width: 140, editable: true },
    { headerName: "Billing", field: "billing", width: 110 },
    { headerName: "Deal", valueGetter: (p) => (p.data ? dealLabel(p.data) : ""), flex: 1, minWidth: 180 },
    {
      headerName: "Guarantee",
      width: 120,
      editable: true,
      valueGetter: (p) => (p.data ? p.data.deal.guaranteeCents / 100 : 0),
      valueFormatter: (p) => fmtShort(toCents(Number(p.value))),
      valueSetter: (p) => {
        const v = Number(String(p.newValue).replace(/[$,]/g, ""));
        if (!Number.isFinite(v) || v < 0 || !p.data) return false;
        p.data.deal = { ...p.data.deal, guaranteeCents: toCents(v) };
        return true;
      },
      cellClass: "font-mono",
    },
    {
      headerName: "Backend %",
      width: 110,
      editable: true,
      valueGetter: (p) => p.data?.deal.backendPct ?? 0,
      valueSetter: (p) => {
        const v = Number(p.newValue);
        if (!Number.isFinite(v) || v < 0 || v > 100 || !p.data) return false;
        p.data.deal = { ...p.data.deal, backendPct: v };
        return true;
      },
    },
    { headerName: "Expense cap", width: 120, valueGetter: (p) => dollars(p.data?.deal.expenseCapCents) },
    { headerName: "Bonuses", width: 170, valueGetter: (p) => p.data?.deal.bonuses.map((b) => `${fmtShort(b.amountCents)} at ${b.ticketsAtLeast}`).join(", ") ?? "" },
    { headerName: "Deposit", width: 100, valueGetter: (p) => dollars(p.data?.deal.depositPaidCents) },
    {
      headerName: "Merch sold",
      width: 120,
      editable: true,
      valueGetter: (p) => (p.data ? p.data.merchGrossCents / 100 : 0),
      valueFormatter: (p) => fmtShort(toCents(Number(p.value))),
      valueSetter: (p) => {
        const v = Number(String(p.newValue).replace(/[$,]/g, ""));
        if (!Number.isFinite(v) || v < 0 || !p.data) return false;
        p.data.merchGrossCents = toCents(v);
        return true;
      },
    },
    {
      headerName: "PayPal email",
      field: "email",
      width: 210,
      editable: true,
      cellClassRules: { "text-hold": (p) => !p.value },
      valueFormatter: (p) => p.value || "add email",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card title={<span className="flex items-center gap-2"><FileText size={14} /> Deal memo</span>}>
        <p className="mb-2 text-sm text-dim">Paste the offer or confirmation email. The agent pulls out every deal term with the exact quote it came from.</p>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={16}
          className="w-full rounded-md border border-line bg-panel-2 p-3 font-mono text-xs leading-relaxed text-ink outline-none focus:border-amber"
          aria-label="Deal memo"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={read} disabled={busy}>{busy ? "Reading..." : "Read the deal memo"}</Button>
          {result && <Button variant="ghost" onClick={apply}>Use these terms</Button>}
          {error && <span className="text-sm text-hold">{error}</span>}
        </div>
        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Pill tone={result.engine === "model" ? "amber" : "dim"}>{result.engine === "model" ? `AI: ${result.model}` : "Rule parser"}</Pill>
              {result.note && <span className="text-dim">{result.note}</span>}
            </div>
            {result.acts.map((a) => (
              <div key={a.name} className="rounded-lg border border-line bg-panel-2 p-3">
                <div className="flex items-center justify-between">
                  <strong>{a.name}</strong>
                  <span className="font-mono text-xs text-amber">{dealLabel({ ...a, id: "x", email: "", merchGrossCents: 0 })}</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs">
                  {Object.entries(a.sources).map(([k, q]) => (
                    <li key={k} className="flex gap-2">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-go" />
                      <span><span className="text-dim">{k}:</span> &ldquo;{q}&rdquo;</span>
                    </li>
                  ))}
                  {a.warnings.map((w) => (
                    <li key={w} className="flex gap-2 text-hold">
                      <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card title="Acts and deals on this show" right={<span className="text-xs text-dim">Double click a cell to edit</span>}>
          <Grid<Act>
            height={250}
            rowData={show.acts.map((a) => ({ ...a, deal: { ...a.deal } }))}
            columnDefs={cols}
            getRowId={(p) => p.data.id}
            onCellValueChanged={(e) => {
              setShow({ ...show, acts: show.acts.map((a) => (a.id === e.data.id ? e.data : a)) });
              log(`Edited ${e.data.name}: ${e.colDef.headerName}`);
            }}
            stopEditingWhenCellsLoseFocus
          />
        </Card>
        <Card title="Guardrails for paying out">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <label className="flex items-center justify-between gap-2 rounded-md border border-line bg-panel-2 px-3 py-2">
              <span className="text-dim">Per-payee cap</span>
              <input
                className="w-28 rounded bg-stage px-2 py-1 text-right font-mono"
                type="number"
                min={0}
                value={show.policy.perPayeeCapCents / 100}
                onChange={(e) => setShow({ ...show, policy: { ...show.policy, perPayeeCapCents: toCents(Math.max(0, Number(e.target.value))) } })}
              />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-md border border-line bg-panel-2 px-3 py-2">
              <span className="text-dim">Two approvers over</span>
              <input
                className="w-28 rounded bg-stage px-2 py-1 text-right font-mono"
                type="number"
                min={0}
                value={show.policy.dualApprovalOverCents / 100}
                onChange={(e) => setShow({ ...show, policy: { ...show.policy, dualApprovalOverCents: toCents(Math.max(0, Number(e.target.value))) } })}
              />
            </label>
          </div>
        </Card>
      </div>
    </div>
  );
}
