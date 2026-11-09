# Settle

**Pay the band before the van pulls out.**

Settle is an AI settlement agent for independent concerts. It reads the deal memo, reconciles PayPal ticket orders, applies every deal in tested code, explains each payout in plain English, and pays every act and crew member in one PayPal Payouts batch, inside guardrails a promoter controls.

- Live demo: https://settle-eight-khaki.vercel.app (open /show; see "Demo modes" below)
- Built for the PayPal AI Hackathon 2026

## The problem

At the end of every small show, a promoter and a tour manager sit in a back office at 1 AM and "settle": count tickets, take out refunds and comps, apply the deal ("$1,500 guarantee vs 80% of net after expenses, expenses capped at $3,200, $250 bonus at 350 tickets, venue keeps 15% of merch, minus the deposit"), then pay the headliner, the support act, the opener, the sound engineer, security and the door. It happens on paper or in a spreadsheet, mistakes are common, and acts and crew often wait days for their money.

Settle is for independent venues, DIY promoters and small talent buyers who do this every week without a back office.

## What it does

1. **Deal.** Paste the offer email. The AI extracts each act's deal into structured terms, and every term carries the exact quote it came from. Settle then checks that each quote is really in the email and that every dollar figure and percentage really appears in it. Anything that fails is flagged, never trusted silently. The deal sits in an editable AG Grid.
2. **Night of.** Fans buy tickets with PayPal Checkout (PayPal JS SDK Smart Buttons; orders are created and captured on the server with the Orders v2 API). Ticket sales chart, orders grid, and one-click PayPal refunds. Expenses and crew day rates are editable grids.
3. **Settle.** The server reconciles every PayPal order against the Orders API (an order that PayPal does not confirm as COMPLETED at the same amount is dropped), then applies flat, versus, plus (split point) and door deals, expense caps, ticket bonuses, merch splits and deposits in deterministic TypeScript. The AI writes each payee a short note; any note with a dollar figure that is not on the sheet is thrown away and replaced by a template.
4. **Pay.** The agent proposes a plan using three tools: `pay_batch`, `hold`, `send_invoice`. Guardrails validate it (it can only pay people the policy allows, it never sets an amount, unknown tools are rejected). Policy checks run on the server: per-payee cap, duplicate email check, funds check, and two different approvers above a threshold. Then one **PayPal Payouts** batch pays everyone, with an idempotent `sender_batch_id`, and statuses stream into the grid. The promoter's share of the bar goes to the venue as a **PayPal invoice**.

## PayPal developer platform

| PayPal API | Where Settle uses it |
| --- | --- |
| JS SDK (Smart Buttons, Venmo enabled) | Ticket checkout on the Night of step |
| Orders v2: create, capture | `/api/orders`, `/api/orders/[id]/capture` |
| Orders v2: get | Reconciliation at settlement: every PayPal ticket order is re-checked |
| Payouts v1: create batch, get batch | One batch pays every act and crew member; live status polling |
| Invoicing v2: create, send, get | Bar split invoice to the venue |
| Payments v2: refund capture | Refund a ticket from the orders grid |
| OAuth 2.0 client credentials | Token cached server side |

All calls go to `api-m.sandbox.paypal.com`. Live PayPal is never used.

## AI

| AI piece | Model | What it does | Guardrail |
| --- | --- | --- | --- |
| Deal memo extraction | Free open models on OpenRouter (default `nvidia/nemotron-3-ultra-550b-a55b:free`, fallbacks `google/gemma-4-31b-it:free`, `nvidia/nemotron-3-super-120b-a12b:free`) | Email to structured deal terms with source quotes | zod schema; quotes must be in the email; figures must appear in the email; rule parser fallback |
| Payee notes | same | Plain English note per payee | Every $ figure must exist in the computed settlement, otherwise template |
| Payout plan | same | Chooses `pay_batch`, `hold`, `send_invoice` steps with reasons | Only policy-payable payees, no amounts from the model, unknown tools dropped, falls back to a rule plan if anyone is missed |

The model never does money math. If no model key is set or the free daily quota is used up, every AI step falls back to deterministic code and the UI says so.

**AI disclosure.** Settle was built with AI coding assistance (an AI coding agent wrote much of the code under human direction). The runtime AI is the OpenRouter models listed above.

## AG Grid

Settle uses **AG Grid Community** and **AG Charts Community** (MIT), no enterprise features and no license key:

- A custom dark "backstage" theme built with the AG Grid Theming API (`themeQuartz.withPart(colorSchemeDarkWarm).withParams(...)`), shared by every grid.
- Editable deal grid with value setters that turn dollars into integer cents and validate input.
- Settlement sheet with a pinned total row, custom pill cell renderers, formula tooltips, preset views driven by the grid API (`setFilterModel`, `applyColumnState`), and CSV export.
- Orders grid with a refund button cell renderer and pagination; payout grid that flashes status changes as PayPal reports them.
- AG Charts: a money waterfall built from stacked bars, a payee donut, and stacked daily ticket sales by source.

## Demo modes

- **PayPal sandbox** when `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set: real sandbox orders, payouts, invoices and refunds.
- **Mock PayPal** otherwise: a stateless adapter with the same interface and PayPal's status names. The header and every payment card say "MOCK PayPal" so nobody mistakes it for the sandbox.
- The demo show, its people and the advance ticket crowd are invented. The advance crowd is labeled "Simulated" in every grid and chart; door sales are labeled "Box office". Payee emails use `example.com`; in the sandbox, payouts to addresses without a sandbox account show as UNCLAIMED, which the grid displays. Replace them with your sandbox personal account emails in the Deal and Night of grids to see SUCCESS.

## Run it

```bash
pnpm install
cp .env.example .env.local   # optional: add PayPal sandbox and OpenRouter keys
pnpm dev                     # http://localhost:3000, then open /show
pnpm test                    # Vitest
pnpm typecheck && pnpm lint && pnpm build
```

PayPal sandbox setup: sign in at https://developer.paypal.com, open Apps & Credentials, Sandbox, create a REST app (Payouts and Invoicing enabled on the app), and copy the client id and secret. Use the default sandbox business account as the payer of payouts (it needs a sandbox balance), and a sandbox personal account to buy tickets.

## Architecture

```
Browser (Next.js 16, React 19)                  Server routes (Node)
 Deal grid, Night of, Settle sheet, Pay  --->   /api/extract   AI extraction + verification
 PayPal JS SDK buttons                   --->   /api/orders, /api/orders/[id]/capture  (Orders v2)
                                         --->   /api/settle    reconcile (Orders v2 get) -> settle() -> policy -> AI notes + plan
                                         --->   /api/payouts   recompute + policy + approvals -> Payouts v1
                                         --->   /api/payouts/[id]  batch status
                                         --->   /api/invoice   Invoicing v2 create + send
                                         --->   /api/refund    Payments v2 refund
```

- `src/lib/settle.ts`: the settlement engine (integer cents, formulas on every line)
- `src/lib/policy.ts`: guardrails and idempotent batch ids
- `src/lib/paypal/`: sandbox REST adapter and the labeled mock, one interface
- `src/lib/extract.ts`, `src/lib/explain.ts`: AI with verification and fallbacks
- The browser never sends an amount the server trusts: payouts and invoices are recomputed on the server from the deal and the reconciled orders.

## Tests

Vitest covers the deal math (versus, plus, door, flat, caps, bonuses, merch, deposits, tax), policy guardrails, the extraction parser and verifier, AI grounding and plan validation with mocked model responses, the mock gateway, and the sandbox adapter request format with a mocked fetch.

## License

MIT
