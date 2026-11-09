import { ArrowRight, Bot, FileText, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";

const steps = [
  { icon: FileText, title: "Read the deal", body: "Paste the offer email. The AI pulls out every guarantee, percentage, cap, bonus and deposit, each with the exact quote it came from. Figures not in the email are flagged." },
  { icon: Wallet, title: "Sell and reconcile", body: "Fans buy with PayPal Checkout. At settlement every PayPal order is re-checked with the Orders API, refunds drop out, box office cash is labeled as declared." },
  { icon: Bot, title: "Settle in code, explain with AI", body: "Versus, plus, door and flat deals are applied in tested TypeScript. The AI writes each person a plain English note, and any number it invents is rejected." },
  { icon: ShieldCheck, title: "Pay inside guardrails", body: "The agent proposes one PayPal Payouts batch. Per-payee caps, duplicate checks, a funds check and two-person approval run before money moves. The bar split goes out as a PayPal invoice." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber px-2 py-0.5 font-black tracking-tight text-amber-ink">SETTLE</span>
        <span className="text-sm text-dim">for independent venues and promoters</span>
      </div>
      <h1 className="mt-8 text-4xl font-black leading-tight sm:text-6xl">
        Pay the band before
        <br />
        the van pulls out.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-dim">
        At 1 AM after every small show, a promoter and a tour manager settle up on paper: tickets, refunds, expenses, the deal, the merch cut. Then the acts and crew wait days for the money. Settle is an AI agent that does the settlement with you and pays everyone through PayPal in one approved batch.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/show" className="inline-flex items-center gap-2 rounded-md bg-amber px-5 py-3 font-semibold text-amber-ink hover:brightness-110">
          Open the demo show <ArrowRight size={18} />
        </Link>
        <a href="https://github.com/Joe-Simo/settle" className="inline-flex items-center rounded-md border border-line px-5 py-3 font-semibold hover:border-amber">
          Source on GitHub
        </a>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {steps.map((s) => (
          <div key={s.title} className="rounded-xl border border-line bg-panel p-5">
            <s.icon className="text-amber" size={22} />
            <h2 className="mt-3 font-bold">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-dim">{s.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-12 text-xs leading-relaxed text-dim">
        Demo data is invented and the advance ticket crowd is simulated, labeled as such. Payments run in the PayPal sandbox (or a clearly labeled mock when no sandbox keys are set); no real money moves. Built with PayPal Orders, Payouts, Invoicing and Refunds APIs, the PayPal JS SDK, AG Grid Community and AG Charts Community, and free open models on OpenRouter. Built with AI coding assistance.
      </p>
    </main>
  );
}
