# Devpost submission: PayPal AI Hackathon 2026

Fill these fields on https://paypalaihackathon.devpost.com (Enter a Submission). Items in [brackets] are filled at submit time.

## Project name
Settle

## Elevator pitch (max 200 characters)
An AI settlement agent for small concerts: it reads the deal memo, reconciles PayPal ticket orders, does the math in code, and pays every act and crew member in one PayPal Payouts batch.

## Try it out links
- https://settle-eight-khaki.vercel.app/show
- https://github.com/Joe-Simo/settle

## Video demo link
[YouTube URL, public, under 3 minutes]

## Sponsor tools used (select on the form)
- AG Grid

## Built with
paypal-payouts-api, paypal-orders-api, paypal-invoicing-api, paypal-js-sdk, ag-grid, ag-charts, openrouter, nemotron, next.js, react, typescript, zod, vitest, tailwind-css, vercel

## About the project

### Inspiration
After every small show, a promoter and a tour manager sit in a back office at 1 AM and settle up. They count tickets, take out refunds, apply a deal like "$1,500 guarantee vs 80% of net after expenses, expenses capped at $3,200, $250 bonus at 350 tickets, venue keeps 15% of merch, minus the $500 deposit", and then pay the headliner, the support act, the opener, the sound engineer, security and the door. It is done on paper or in a spreadsheet, mistakes are common, and people wait days to get paid. Independent venues and DIY promoters run this every week without a back office.

### What it does
Settle runs the whole night in four steps.

1. **Deal.** Paste the offer email. The AI extracts each act's deal (flat, versus, plus or door, with guarantee, percentage, expense cap, ticket bonuses, merch split and deposit). Every term carries the exact quote it came from, and Settle checks that each quote and each dollar figure really appears in the email. Anything that does not match is flagged for the promoter. The terms land in an editable AG Grid.
2. **Night of.** Fans buy tickets with PayPal Checkout (JS SDK Smart Buttons, orders created and captured on the server with Orders v2). Sales chart, orders grid with one-click PayPal refunds, and editable grids for expenses and crew day rates.
3. **Settle.** The server re-checks every PayPal ticket order with the Orders API and drops anything PayPal does not confirm. Then tested TypeScript applies every deal, cap, bonus, merch split and deposit, with a formula on every line. The AI writes each person a short plain English note, and any note that mentions a number not on the sheet is thrown out and replaced with a template.
4. **Pay.** The agent proposes a plan with three tools: pay_batch, hold and send_invoice. Guardrails check it: it can only pay people the policy allows and it never sets an amount. Server policy checks run again (per-payee cap, duplicate email, funds collected, two different approvers above a threshold). Then one PayPal Payouts batch pays everyone with an idempotent sender_batch_id, and each payout status streams into the grid. The promoter's share of the bar goes to the venue as a PayPal invoice.

### How we built it
- **PayPal:** Orders v2 (create, capture, get for reconciliation), Payouts v1 (create batch, get batch), Invoicing v2 (create, send, get), Payments v2 refunds, OAuth client credentials, and the PayPal JS SDK for checkout. Everything runs against the sandbox; one adapter interface has a sandbox implementation and a clearly labeled mock.
- **AI:** free open models through OpenRouter (default nvidia/nemotron-3-ultra-550b-a55b:free with two fallbacks) for deal extraction, payee notes and the payout plan. Outputs are parsed with zod and checked against the memo and the computed settlement. Every AI step has a deterministic fallback, and the UI always shows which one ran.
- **AG Grid:** AG Grid Community and AG Charts Community with a custom dark "backstage" theme from the Theming API, editable grids with validating value setters, a settlement sheet with a pinned total row, custom cell renderers, formula tooltips, grid API preset views and CSV export, a payout grid that flashes status changes, and a money waterfall built from stacked bars.
- **App:** Next.js 16, React 19, TypeScript, zod, Tailwind, Vitest, hosted on Vercel.

### Challenges we ran into
Keeping the AI useful without letting it touch money. The model reads and explains, but amounts only come from the settlement code, and the server recomputes the settlement and the policy before a payout or invoice is sent, so the browser cannot change a number. Free models also time out or run out of daily quota, so every AI step falls back to deterministic code instead of failing the night.

### Accomplishments that we're proud of
- The whole settlement loop works end to end: memo, tickets, reconciliation, settlement sheet, approvals, one payout batch, invoice and refunds.
- 43 automated tests cover versus, plus, door and flat deals, caps, bonuses, merch, deposits, tax, guardrails, AI grounding and the PayPal request format.
- Every number on the sheet shows its formula.

### What we learned
Agentic payments need a clear split of duties. Let the model plan and explain, let code compute, let policy decide, and let a person approve.

### What's next for Settle
Webhooks for payout status, settlement PDFs for each act, multi-show tours, and venue accounting exports.

## Judging criteria map
- **Technological implementation:** six PayPal surfaces (JS SDK checkout, Orders create, capture and get, Payouts, Invoicing, Refunds); AI for extraction, explanation and planning, each verified; server-side recomputation; 43 tests.
- **Design:** one complete flow in four steps with a live agent activity log, editable grids, and clear empty, error, stale and mock states.
- **Potential impact:** independent venues and promoters settle every show by hand and acts wait days to get paid; Settle pays everyone the same night with an audit trail.
- **Innovation:** an AI agent that moves money inside explicit guardrails (policy-only payees, no model-set amounts, dual approval, idempotent batches, reconciliation against PayPal).
- **Presentation:** video under 3 minutes showing the whole night end to end.

## Testing instructions (for judges)
Open https://settle-eight-khaki.vercel.app/show. No login. Step 1: click "Read the deal memo", then "Use these terms". Step 2: buy a ticket with the PayPal button. Step 3: click "Settle the show" and click any row to see the math and the AI note. Step 4: type a second approver name and click "Pay 6 people". The header shows whether PayPal is in sandbox or MOCK mode and which AI model ran. "Reset demo" restores the starting show. Run locally with the steps in the README.

## AI disclosure
- Runtime AI: free open models on OpenRouter (default nvidia/nemotron-3-ultra-550b-a55b:free; fallbacks nvidia/nemotron-3.5-super-vl:free and google/gemma-4-31b-it:free) for deal memo extraction, payee notes and the payout plan.
- Development: the project was built with AI coding assistance (an AI coding agent wrote much of the code and the text under human direction).
- Video: the voiceover is a synthetic text-to-speech voice (Piper), disclosed on screen.
- Demo data: all names are invented, and the advance ticket crowd is simulated and labeled as such.
