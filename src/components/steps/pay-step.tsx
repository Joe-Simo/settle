"use client";

import type { ColDef } from "ag-grid-community";
import { Bot, CheckCircle2, Printer, Receipt, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Grid } from "@/components/grid";
import { api, type InvoiceInfo, type PayoutBatch, type SettleResult, type StepProps } from "@/components/types";
import { Button, Card, Pill } from "@/components/ui";
import { fmtShort } from "@/lib/money";

type Row = PayoutBatch["items"][number] & { name: string };

const TONE: Record<string, "go" | "hold" | "amber" | "dim"> = { SUCCESS: "go", UNCLAIMED: "amber", PENDING: "dim", ONHOLD: "amber", FAILED: "hold", RETURNED: "hold", BLOCKED: "hold", DENIED: "hold" };

export function PayStep(props: StepProps & { result: SettleResult | null; stale: boolean; batch: PayoutBatch | null; setBatch: (b: PayoutBatch | null) => void; invoice: InvoiceInfo | null; setInvoice: (i: InvoiceInfo | null) => void }) {
  const { show, result, log, stale, batch, setBatch, invoice, setInvoice, status } = props;
  const [a1, setA1] = useState("Sam (promoter)");
  const [a2, setA2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const batchId = batch?.batchId;
  const finished = batch && !["PENDING", "PROCESSING"].includes(batch.status);
  useEffect(() => {
    if (!batchId || finished) return;
    const t = setInterval(async () => {
      try {
        const b = await api<PayoutBatch>(`/api/payouts/${encodeURIComponent(batchId)}`);
        setBatch(b);
        if (!["PENDING", "PROCESSING"].includes(b.status)) log(`PayPal Payouts: batch ${b.status}`, "go");
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [batchId, finished, setBatch, log]);

  if (!result) return <Card><p className="text-sm text-dim">Settle the show first. The agent then proposes the payouts here.</p></Card>;
  const { policy, plan, settlement } = result;
  const names = Object.fromEntries(settlement.payees.map((p) => [p.id, p.name]));

  async function pay() {
    setBusy(true);
    setError("");
    log(`Approved by ${[a1, a2].filter(Boolean).join(" and ")}. Sending one PayPal Payouts batch.`, "pp");
    try {
      const r = await api<{ batch: PayoutBatch; senderBatchId: string }>("/api/payouts", { show, approvers: [a1, a2] });
      setBatch(r.batch);
      log(`PayPal Payouts: batch ${r.batch.batchId.slice(0, 24)} created (${r.batch.status}), sender_batch_id ${r.senderBatchId}`, "pp");
    } catch (e) {
      setError((e as Error).message);
      log(`Payout refused: ${(e as Error).message}`, "hold");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvoice() {
    setError("");
    try {
      const r = await api<{ invoice: InvoiceInfo }>("/api/invoice", { show });
      setInvoice(r.invoice);
      log(`PayPal Invoicing: bar split invoice ${r.invoice.number ?? r.invoice.id} ${r.invoice.status}`, "pp");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const rows: Row[] = (batch?.items ?? []).map((i) => ({ ...i, name: names[i.senderItemId] ?? i.senderItemId }));
  const cols: ColDef<Row>[] = [
    { headerName: "Payee", field: "name", width: 150, cellClass: "font-semibold" },
    { headerName: "PayPal email", field: "receiver", flex: 1, minWidth: 180 },
    { headerName: "Amount", field: "amountCents", width: 110, valueFormatter: (p) => fmtShort(p.value ?? 0), cellClass: "font-mono" },
    { headerName: "Status", field: "status", width: 130, enableCellChangeFlash: true, cellRenderer: (p: { value?: string }) => <Pill tone={TONE[p.value ?? ""] ?? "dim"}>{p.value}</Pill> },
    { headerName: "Transaction", field: "transactionId", width: 190, cellClass: "font-mono text-xs" },
  ];

  const needs2 = policy.approvalsNeeded === 2;
  const canPay = !policy.blocked && !stale && a1.trim() && (!needs2 || (a2.trim() && a2.trim().toLowerCase() !== a1.trim().toLowerCase())) && !batch;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Bot size={14} /> Agent plan</span>} right={<Pill tone={plan.engine === "model" ? "amber" : "dim"}>{plan.engine === "model" ? `AI: ${plan.model}` : "Rule plan"}</Pill>}>
          <p className="mb-3 text-sm">{plan.summary}</p>
          <ol className="space-y-2 text-sm">
            {plan.steps.map((st, i) => (
              <li key={i} className="rounded-md border border-line bg-panel-2 p-2">
                <span className="font-mono text-xs text-amber">{st.tool}</span>{" "}
                {st.tool === "pay_batch" && <span className="text-dim">{st.payeeIds.map((id) => names[id]).join(", ")}</span>}
                {st.tool === "hold" && <span className="text-dim">{names[st.payeeId]}</span>}
                <div className="text-xs text-dim">{st.why}</div>
              </li>
            ))}
          </ol>
          {plan.rejected.length > 0 && (
            <div className="mt-3 text-xs text-hold">
              Guardrails removed: {plan.rejected.join("; ")}
            </div>
          )}
          <p className="mt-3 text-xs text-dim">The agent proposes; it cannot set amounts. Amounts come from the settlement code, and the server recomputes them before any money moves.</p>
        </Card>
        <Card title={<span className="flex items-center gap-2"><ShieldCheck size={14} /> Policy checks</span>}>
          <ul className="space-y-1.5 text-sm">
            {policy.checks.map((c) => (
              <li key={c.id} className="flex gap-2">
                {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-go" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-hold" />}
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
          {policy.held.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="text-xs uppercase tracking-wider text-dim">Held</div>
              {policy.held.map((h) => (
                <div key={h.payeeId} className="text-hold">{h.name}: {h.reason}</div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card title="Approve and pay" right={<Pill tone={status?.paypal === "sandbox" ? "pp" : "hold"}>{status?.paypal === "sandbox" ? "PayPal sandbox" : "MOCK PayPal"}</Pill>}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <div className="text-xs text-dim">Approver 1</div>
            <input value={a1} onChange={(e) => setA1(e.target.value)} className="mt-1 w-52 rounded-md border border-line bg-panel-2 px-3 py-2" />
          </label>
          {needs2 && (
            <label className="text-sm">
              <div className="text-xs text-dim">Approver 2 (batch is over {fmtShort(show.policy.dualApprovalOverCents)})</div>
              <input value={a2} onChange={(e) => setA2(e.target.value)} placeholder="Tour manager" className="mt-1 w-52 rounded-md border border-line bg-panel-2 px-3 py-2" />
            </label>
          )}
          <Button onClick={pay} disabled={!canPay || busy}>
            {busy ? "Sending..." : `Pay ${policy.payable.length} people ${fmtShort(policy.totalCents)} with PayPal`}
          </Button>
          {settlement.barInvoice && (
            <Button variant="ghost" onClick={sendInvoice} disabled={!!invoice}>
              <Receipt size={16} /> {invoice ? `Invoice ${invoice.status}` : `Invoice the bar split (${fmtShort(settlement.barInvoice.amountCents)})`}
            </Button>
          )}
        </div>
        {stale && <p className="mt-2 text-sm text-hold">The show changed after settling. Settle again before paying.</p>}
        {error && <p className="mt-2 text-sm text-hold">{error}</p>}
        {invoice && (
          <p className="mt-2 text-xs text-dim">
            Invoice {invoice.number ?? invoice.id} sent to {settlement.barInvoice?.venueName}.{" "}
            {invoice.payerViewUrl && <a className="text-pp underline" href={invoice.payerViewUrl} target="_blank" rel="noreferrer">Open the payer view</a>}
          </p>
        )}
      </Card>
      {batch && (
        <Card title="Payout batch" right={<span className="flex items-center gap-2 text-xs"><span className="font-mono text-dim">{batch.batchId.slice(0, 28)}</span><Pill tone={TONE[batch.status] ?? "dim"}>{batch.status}</Pill></span>}>
          <Grid<Row> height={300} rowData={rows} columnDefs={cols} getRowId={(p) => p.data.senderItemId} />
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" onClick={() => window.print()} className="no-print"><Printer size={16} /> Print settlement receipts</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
