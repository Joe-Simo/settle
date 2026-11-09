"use client";

import { AllCommunityModule, ModuleRegistry, type AgChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import { useMemo } from "react";
import { fmtShort } from "@/lib/money";
import type { Order } from "@/lib/schema";
import type { Settlement } from "@/lib/settle";
import { salesByDay, waterfallRows } from "@/lib/chart-data";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = {
  baseTheme: "ag-default-dark",
  palette: { fills: ["#f5a524", "#34d399", "#60a5fa", "#fb7185", "#c084fc", "#facc15"], strokes: ["#f5a524"] },
  overrides: { common: { background: { fill: "#1a1614" } } },
} as const;

/** Money waterfall built from stacked community bars: an invisible base plus up, down and total segments. */
export function WaterfallChart({ s }: { s: Settlement }) {
  const data = useMemo(() => waterfallRows(s), [s]);
  const options = {
    theme,
    data,
    title: { text: "Where the money went" },
    series: [
      { type: "bar", xKey: "label", yKey: "base", stacked: true, fill: "transparent", strokeWidth: 0, showInLegend: false, tooltip: { enabled: false } },
      { type: "bar", xKey: "label", yKey: "total", yName: "Total", stacked: true, fill: "#f5a524" },
      { type: "bar", xKey: "label", yKey: "up", yName: "In", stacked: true, fill: "#34d399" },
      { type: "bar", xKey: "label", yKey: "down", yName: "Out", stacked: true, fill: "#fb7185" },
    ],
  } as unknown as AgChartOptions;
  return <AgCharts options={options} style={{ height: 300 }} />;
}

export function PayeeDonut({ s }: { s: Settlement }) {
  const options = {
    theme,
    data: s.payees.filter((p) => p.dueCents > 0).map((p) => ({ name: p.name, due: p.dueCents / 100, label: fmtShort(p.dueCents) })),
    title: { text: "Who gets paid tonight" },
    series: [{ type: "donut", angleKey: "due", legendItemKey: "name", sectorLabelKey: "label", innerRadiusRatio: 0.55, sectorLabel: { color: "#1a1614", fontWeight: "bold" } }],
  } as unknown as AgChartOptions;
  return <AgCharts options={options} style={{ height: 300 }} />;
}

export function SalesChart({ orders }: { orders: Order[] }) {
  const data = useMemo(() => salesByDay(orders), [orders]);
  const options = {
    theme,
    data,
    title: { text: "Ticket sales" },
    series: [
      { type: "bar", xKey: "day", yKey: "adv", yName: "Advance (simulated crowd)", stacked: true },
      { type: "bar", xKey: "day", yKey: "paypal", yName: "PayPal Checkout", stacked: true, fill: "#60a5fa" },
      { type: "bar", xKey: "day", yKey: "door", yName: "Door (box office)", stacked: true, fill: "#34d399" },
    ],
  } as unknown as AgChartOptions;
  return <AgCharts options={options} style={{ height: 280 }} />;
}
