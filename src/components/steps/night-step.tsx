"use client";

import type { ColDef } from "ag-grid-community";
import { SalesChart } from "@/components/charts";
import { Checkout } from "@/components/checkout";
import { Grid } from "@/components/grid";
import { api, type StepProps } from "@/components/types";
import { Card, Pill, Stat } from "@/components/ui";
import { fmtShort, sum, toCents } from "@/lib/money";
import type { Expense, Order, Staff } from "@/lib/schema";

const SOURCE: Record<Order["source"], { label: string; tone: "pp" | "go" | "dim" }> = {
  paypal: { label: "PayPal", tone: "pp" },
  boxoffice: { label: "Box office", tone: "go" },
  simulated: { label: "Simulated", tone: "dim" },
};

export function NightStep(props: StepProps) {
  const { show, setShow, log } = props;
  const done = show.orders.filter((o) => o.status === "COMPLETED");
  const tickets = sum(done.map((o) => o.qty));
  const gross = sum(done.map((o) => o.amountCents));
  const viaPayPal = sum(done.filter((o) => o.source === "paypal").map((o) => o.amountCents));

  async function refund(o: Order) {
    if (!o.captureId) return;
    try {
      await api("/api/refund", { captureId: o.captureId });
      setShow({ ...show, orders: show.orders.map((x) => (x.id === o.id ? { ...x, status: "REFUNDED" } : x)) });
      log(`PayPal refund: ${o.qty} ticket(s), ${fmtShort(o.amountCents)} back to the buyer`, "pp");
    } catch (e) {
      log(`Refund failed: ${(e as Error).message}`, "hold");
    }
  }

  const orderCols: ColDef<Order>[] = [
    { headerName: "Time", field: "at", width: 150, sort: "desc", valueFormatter: (p) => new Date(p.value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) },
    { headerName: "Source", field: "source", width: 120, cellRenderer: (p: { value: Order["source"] }) => <Pill tone={SOURCE[p.value].tone}>{SOURCE[p.value].label}</Pill> },
    { headerName: "Tier", field: "tierId", width: 90, valueFormatter: (p) => (p.value === "door" ? "Door" : "Advance") },
    { headerName: "Qty", field: "qty", width: 70 },
    { headerName: "Amount", field: "amountCents", width: 100, valueFormatter: (p) => fmtShort(p.value), cellClass: "font-mono" },
    { headerName: "Status", field: "status", width: 120, cellRenderer: (p: { value: string }) => <Pill tone={p.value === "COMPLETED" ? "go" : "hold"}>{p.value}</Pill> },
    { headerName: "PayPal order", field: "paypalOrderId", flex: 1, minWidth: 140, valueFormatter: (p) => (p.value ? String(p.value).slice(0, 22) : "") },
    {
      headerName: "",
      width: 100,
      cellRenderer: (p: { data?: Order }) =>
        p.data?.source === "paypal" && p.data.status === "COMPLETED" ? (
          <button className="text-xs font-semibold text-hold underline" onClick={() => p.data && refund(p.data)}>Refund</button>
        ) : null,
    },
  ];

  const moneyCol = <T,>(field: string, onSet: (row: T, cents: number) => void): ColDef<T> => ({
    headerName: "Amount",
    width: 120,
    editable: true,
    cellClass: "font-mono",
    valueGetter: (p) => ((p.data as Record<string, number> | undefined)?.[field] ?? 0) / 100,
    valueFormatter: (p) => fmtShort(toCents(Number(p.value))),
    valueSetter: (p) => {
      const v = Number(String(p.newValue).replace(/[$,]/g, ""));
      if (!Number.isFinite(v) || v < 0 || !p.data) return false;
      onSet(p.data, toCents(v));
      return true;
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Paid tickets" value={tickets} sub={`of ${show.capacity}, plus ${show.comps} comps`} />
        <Stat label="Gross" value={fmtShort(gross)} sub={`${show.orders.filter((o) => o.status === "REFUNDED").length} refunded orders excluded`} />
        <Stat label="Paid with PayPal" value={fmtShort(viaPayPal)} sub="checked against the Orders API at settlement" />
        <Stat label="Box office and simulated" value={fmtShort(gross - viaPayPal)} sub="declared by the promoter" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Card title="Sales">
          <SalesChart orders={show.orders} />
        </Card>
        <div className="space-y-3">
          <Checkout {...props} />
          <p className="text-xs leading-relaxed text-dim">
            The advance crowd is simulated demo data and is labeled that way. Every ticket you buy here is a real PayPal order in the sandbox, captured on the server and re-checked with the Orders API when the show settles.
          </p>
        </div>
      </div>
      <Card title="Orders" right={<span className="text-xs text-dim">{show.orders.length} orders</span>}>
        <Grid<Order> height={300} rowData={show.orders} columnDefs={orderCols} getRowId={(p) => p.data.id} pagination paginationPageSize={50} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Show expenses" right={<span className="font-mono text-sm">{fmtShort(sum(show.expenses.map((e) => e.amountCents)))}</span>}>
          <Grid<Expense>
            height={240}
            rowData={show.expenses.map((e) => ({ ...e }))}
            getRowId={(p) => p.data.id}
            columnDefs={[{ headerName: "Expense", field: "label", flex: 1, editable: true }, moneyCol<Expense>("amountCents", (r, c) => (r.amountCents = c))]}
            onCellValueChanged={(e) => setShow({ ...show, expenses: show.expenses.map((x) => (x.id === e.data.id ? e.data : x)) })}
            stopEditingWhenCellsLoseFocus
          />
        </Card>
        <Card title="Crew day rates">
          <Grid<Staff>
            height={240}
            rowData={show.staff.map((s) => ({ ...s }))}
            getRowId={(p) => p.data.id}
            columnDefs={[
              { headerName: "Name", field: "name", width: 120 },
              { headerName: "Role", field: "role", flex: 1 },
              { headerName: "PayPal email", field: "email", width: 190, editable: true },
              moneyCol<Staff>("flatCents", (r, c) => (r.flatCents = c)),
            ]}
            onCellValueChanged={(e) => setShow({ ...show, staff: show.staff.map((x) => (x.id === e.data.id ? e.data : x)) })}
            stopEditingWhenCellsLoseFocus
          />
        </Card>
      </div>
    </div>
  );
}
