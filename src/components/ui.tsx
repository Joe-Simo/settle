import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...a: Parameters<typeof clsx>) {
  return clsx(...a);
}

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "pp" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-amber text-amber-ink hover:brightness-110",
        variant === "ghost" && "border border-line bg-panel-2 text-ink hover:border-amber/60",
        variant === "pp" && "bg-[#ffc439] text-[#111] hover:brightness-105",
        className,
      )}
    />
  );
}

export function Card({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-panel p-4", className)}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-dim">{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Pill({ tone = "dim", children }: { tone?: "dim" | "go" | "hold" | "amber" | "pp"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "dim" && "bg-panel-2 text-dim",
        tone === "go" && "bg-go/15 text-go",
        tone === "hold" && "bg-hold/15 text-hold",
        tone === "amber" && "bg-amber/15 text-amber",
        tone === "pp" && "bg-pp/15 text-pp",
      )}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-dim">{label}</div>
      <div className="mt-1 font-mono text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-dim">{sub}</div>}
    </div>
  );
}
