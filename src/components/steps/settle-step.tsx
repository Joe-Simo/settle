"use client";

import type { ColDef, GridApi } from "ag-grid-community";
import { Download, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PayeeDonut, WaterfallChart } from "@/components/charts";
import { Grid } from "@/components/grid";
import { api, type SettleResult, type StepProps } from "@/components/types";
import { Button, Card, Pill, Stat } from "@/components/ui";
import { fmtShort } from "@/lib/money";
import type { PayeeResult } from "@/lib/settle";

const OUTCOME: Record<PayeeResult["outcome"], { label: string; tone: "amber" | "go" | "dim" | "pp" }> = {
  backend: { label: "Backend", tone: "amber" },
  guarantee: { label: "Guarantee", tone: "pp" },
  flat: { label: "Flat", tone: "dim" },
  door: { label: "Door split", tone: "go" },
};

export function SettleStep(props: StepProps & { result: SettleResult | null; setResult: (r: SettleResult | null) => void; stale: boolean }) {
  const { show, result, setResult, log, stale } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const gridApi = useRef<GridApi<PayeeResult> | null>(null);

  async function run() {
    setBusy(true);
    setError("");
    log("Agent: settling the show");
    try {
      const r = await api<SettleResult>("/api/settle", { show });
      setResult(r);
      r.trace.forEach((t) => log(`Agent ${t.step}: ${t.detail}`, t.step === "reconcile" ? "pp" : "info"));
      setPicked(r.settlement.payees[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const s = result?.settlement;
  const cols = useMemo<ColDef<PayeeResult>[]>(
    () => [
      { headerName: "Payee", field: "name", pinned: "left", width: 150, cellClass: "font-semibold" },
      { headerName: "Role", field: "role", width: 130 },
      { headerName: "Kind", field: "kind", hide: true },
      { headerName: "Deal", field: "dealLabel", flex: 1, minWidth: 170 },
      {
        headerName: "Result",
        field: "outcome",
        width: 120,
        cellRenderer: (p: { value?: PayeeResult["outcome"] }) => (p.value ? <Pill tone={OUTCOME[p.value].tone}>{OUTCOME[p.value].label}</Pill> : null),
      },
      { headerName: "Earned", field: "earnedCents", width: 110, valueFormatter: (p) => fmtShort(p.value ?? 0), cellClass: "font-mono", tooltipValueGetter: (p) => p.data?.lines.map((l) => `${l.label}: ${fmtShort(l.amountCents)} (${l.formula})`).join("\n") },
      { headerName: "Bonus", field: "bonusCents", width: 95, valueFormatter: (p) => (p.value ? fmtShort(p.value) : ""), cellClass: "font-mono" },
      { headerName: "Merch", field: "merchNetCents", width: 105, valueFormatter: (p) => (p.value ? fmtShort(p.value) : ""), cellClass: "font-mono" },
      { headerName: "Deposit", field: "depositCents", width: 100, valueFormatter: (p) => (p.value ? `-${fmtShort(p.value)}` : ""), cellClass: "font-mono text-hold" },
      { headerName: "Due tonight", field: "dueCents", width: 130, sort: "desc", valueFormatter: (p) => fmtShort(p.value ?? 0), cellClass: "font-mono font-bold text-amber" },
    ],
    [],
  );

  const totalRow = s
    ? [
        {
          id: "total",
          kind: "act",
          name: "Total",
          role: "",
          email: "",
          dealLabel: `${s.payees.length} payees`,
          earnedCents: s.payees.reduce((a, p) => a + p.earnedCents, 0),
          bonusCents: s.payees.reduce((a, p) => a + p.bonusCents, 0),
          merchNetCents: s.payees.reduce((a, p) => a + p.merchNetCents, 0),
          depositCents: s.payees.reduce((a, p) => a + p.depositCents, 0),
          dueCents: s.totalDueCents,
          owesBackCents: 0,
          outcome: "flat",
          lines: [],
          facts: [],
        } as PayeeResult,
      ]
    : [];

  const view = (name: string) => {
    const a = gridApi.current;
    if (!a) return;
    a.setFilterModel(null);
    if (name === "acts") a.setFilterModel({ kind: { filterType: "text", type: "equals", filter: "act" } });
    if (name === "crew") a.setFilterModel({ kind: { filterType: "text", type: "equals", filter: "staff" } });
    if (name === "biggest") a.applyColumnState({ state: [{ colId: "dueCents", sort: "desc" }], defaultState: { sort: null } });
    if (name === "backend") a.setFilterModel({ outcome: { filterType: "text", type: "equals", filter: "backend" } });
  };

  const payee = s?.payees.find((p) => p.id === picked);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy}>
          <Sparkles size={16} />
          {busy ? "Settling..." : result ? "Settle again" : "Settle the show"}
        </Button>
        {stale && result && <Pill tone="hold">The show changed since this settlement. Settle again.</Pill>}
        {error && <span className="text-sm text-hold">{error}</span>}
        {result && (
          <span className="text-xs text-dim">
            Math in code. Notes by {result.notes.engine === "model" ? result.notes.model : "template"}. {result.verification.length} PayPal orders re-checked.
          </span>
        )}
      </div>
      {!s && <Card><p className="text-sm text-dim">Settling reconciles every PayPal order with the Orders API, applies each deal in deterministic code, checks the payout policy, and has the AI explain each line in plain English.</p></Card>}
      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Paid tickets" value={s.ticketsSold} sub={`${s.refunds} refunded`} />
            <Stat label="Gross" value={fmtShort(s.grossCents)} sub={`${fmtShort(s.verifiedGrossCents)} verified with PayPal`} />
            <Stat label="Talent" value={fmtShort(s.talentCents)} />
            <Stat label="Due tonight" value={fmtShort(s.totalDueCents)} sub={`${s.payees.length} people`} />
            <Stat label="Promoter net" value={fmtShort(s.promoterNetCents)} sub={s.barInvoice ? `incl. ${fmtShort(s.barInvoice.amountCents)} bar split` : undefined} />
          </div>
          <Card
            title="Settlement sheet"
            right={
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  ["all", "All"],
                  ["acts", "Acts"],
                  ["crew", "Crew"],
                  ["backend", "Backend deals"],
                  ["biggest", "Biggest first"],
                ].map(([k, l]) => (
                  <button key={k} className="rounded border border-line px-2 py-1 hover:border-amber" onClick={() => view(k)}>{l}</button>
                ))}
                <button
                  className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 hover:border-amber"
                  onClick={() => gridApi.current?.exportDataAsCsv({ fileName: `settlement-${show.id}.csv` })}
                >
                  <Download size={12} /> CSV
                </button>
              </div>
            }
          >
            <Grid<PayeeResult>
              height={330}
              rowData={s.payees}
              columnDefs={cols}
              pinnedBottomRowData={totalRow}
              getRowId={(p) => p.data.id}
              rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
              onRowClicked={(e) => e.data && e.data.id !== "total" && setPicked(e.data.id)}
              onGridReady={(e) => (gridApi.current = e.api)}
              defaultColDef={{ filter: true, sortable: true }}
              tooltipShowDelay={200}
            />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            {payee && (
              <Card title={`The math for ${payee.name}`} right={<span className="font-mono text-amber">{fmtShort(payee.dueCents)}</span>}>
                <table className="w-full text-sm">
                  <tbody>
                    {payee.lines.map((l, i) => (
                      <tr key={i} className="border-b border-line/60">
                        <td className="py-1.5 pr-2">{l.label}</td>
                        <td className="py-1.5 pr-2 text-xs text-dim">{l.formula}</td>
                        <td className="py-1.5 text-right font-mono">{fmtShort(l.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 rounded-lg border border-amber/30 bg-amber/5 p-3 text-sm leading-relaxed">
                  <div className="mb-1 flex items-center gap-2 text-xs text-amber">
                    <Sparkles size={12} /> {result.notes.engine === "model" && !result.notes.rejected.includes(payee.id) ? "Written by AI, numbers checked against the sheet" : "Template note"}
                  </div>
                  {result.notes.notes[payee.id]}
                </div>
              </Card>
            )}
            <Card><WaterfallChart s={s} /></Card>
          </div>
          <Card><PayeeDonut s={s} /></Card>
        </>
      )}
    </div>
  );
}
