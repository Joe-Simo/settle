"use client";

import { useEffect, useRef, useState } from "react";
import { api, type StepProps } from "@/components/types";
import { Button, Pill } from "@/components/ui";
import { DEMO_INPUT } from "@/lib/demo";
import { fmtShort } from "@/lib/money";
import type { Order } from "@/lib/schema";

type Created = { id: string; amountCents: number; tierId: string; qty: number };
type Captured = { id: string; status: string; amountCents: number; captureId?: string; payerEmail?: string };

declare global {
  interface Window {
    paypal?: {
      Buttons: (o: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close?: () => void };
    };
  }
}

/** Ticket checkout. Sandbox mode renders real PayPal Smart Buttons (JS SDK). Mock mode runs the same server routes. */
export function Checkout({ show, setShow, status, log }: StepProps) {
  const [tierId, setTierId] = useState("adv");
  const [qty, setQty] = useState(2);
  const [msg, setMsg] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef({ show, tierId, qty });
  useEffect(() => {
    latest.current = { show, tierId, qty };
  });

  function record(c: Captured, created: Created) {
    const cur = latest.current.show;
    const order: Order = {
      id: `PP-${c.id.slice(-10)}`,
      source: "paypal",
      tierId: created.tierId,
      qty: created.qty,
      amountCents: c.amountCents,
      status: "COMPLETED",
      at: new Date().toISOString(),
      paypalOrderId: c.id,
      captureId: c.captureId,
      buyer: c.payerEmail,
    };
    setShow({ ...cur, orders: [...cur.orders, order] });
    setMsg(`Paid ${fmtShort(c.amountCents)}. PayPal order ${c.id.slice(0, 18)} captured.`);
    log(`PayPal Checkout: captured order for ${created.qty} ticket(s), ${fmtShort(c.amountCents)}`, "pp");
  }

  useEffect(() => {
    if (status?.paypal !== "sandbox" || !status.clientId || !box.current) return;
    const el = box.current;
    let created: Created | null = null;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.paypal) return;
      el.innerHTML = "";
      void window.paypal
        .Buttons({
          style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },
          createOrder: async () => {
            created = await api<Created>("/api/orders", { tierId: latest.current.tierId, qty: latest.current.qty });
            return created.id;
          },
          onApprove: async (data: { orderID: string }) => {
            const c = await api<Captured>(`/api/orders/${data.orderID}/capture`, {});
            if (created) record(c, created);
          },
          onError: (err: unknown) => setMsg(`PayPal error: ${String(err)}`),
        })
        .render(el);
    };
    if (window.paypal) render();
    else {
      const s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(status.clientId)}&currency=USD&intent=capture&components=buttons&enable-funding=venmo`;
      s.onload = render;
      document.body.appendChild(s);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.paypal, status?.clientId]);

  async function mockPay() {
    setMsg("");
    try {
      const created = await api<Created>("/api/orders", { tierId, qty });
      const c = await api<Captured>(`/api/orders/${encodeURIComponent(created.id)}/capture`, {});
      record(c, created);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const tier = DEMO_INPUT.tiers.find((t) => t.id === tierId)!;
  return (
    <div className="ticket-edge rounded-xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-dim">Buy a ticket</div>
          <div className="font-semibold">{show.name}</div>
        </div>
        <Pill tone={status?.paypal === "sandbox" ? "pp" : "hold"}>{status?.paypal === "sandbox" ? "PayPal sandbox" : "MOCK PayPal"}</Pill>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={tierId} onChange={(e) => setTierId(e.target.value)} className="rounded-md border border-line bg-panel-2 px-2 py-2 text-sm" aria-label="Ticket type">
          {DEMO_INPUT.tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.name} {fmtShort(t.priceCents)}</option>
          ))}
        </select>
        <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="rounded-md border border-line bg-panel-2 px-2 py-2 text-sm" aria-label="Quantity">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <div className="ml-auto self-center font-mono text-lg">{fmtShort(tier.priceCents * qty)}</div>
      </div>
      <div className="mt-3">
        {status?.paypal === "sandbox" ? (
          <div ref={box} className="min-h-12" />
        ) : (
          <Button variant="pp" className="w-full" onClick={mockPay}>Pay with PayPal (mock)</Button>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-dim">{msg}</p>}
    </div>
  );
}
