# Devpost submission: PayPal AI Hackathon 2026

Paste these fields on https://paypalaihackathon.devpost.com (Enter a Submission). Official rules: https://paypalaihackathon.devpost.com/rules. Deadline: Thursday, Nov 12, 2026, 3:00 PM EST (12:00 PM PST).

Items in [brackets] or marked PLACEHOLDER are filled at submit time. This draft matches the required submission materials: project name, text description, functional demo URL, public open-source repository with a visible MIT license, built-with and AI tools disclosure, AG Grid sponsor notes, testing instructions, and a public YouTube demo under 3 minutes.

Current PayPal mode (as of this draft): the live demo runs in clearly labeled MOCK PayPal mode. A short swap-in paragraph is at the end for when the real PayPal sandbox is connected.

## Project name
Settle

## Tagline / Elevator pitch (max 200 characters; this draft is 186)
An AI settlement agent for small concerts: it reads the deal memo, reconciles PayPal ticket orders, does the math in code, and pays every act and crew member in one PayPal Payouts batch.

## Try it out
- Live demo: https://settle-eight-khaki.vercel.app/show
- Public repository: https://github.com/Joe-Simo/settle

The repository is public, open source under the MIT license (LICENSE file, also shown in the GitHub About section), and includes setup and run instructions in the README so judges can run it locally.

## Video demo link
YOUTUBE_URL

The local file is /workspace/hackathons/settle/submission/settle-demo.mp4 (2 minutes 38 seconds, under the 3-minute limit). Upload it to the connected YouTube channel as Public before submitting, then paste the public URL here. The video shows the project running in the browser, uses a synthetic Piper voice disclosed on screen, and has no copyrighted music.

## Images (upload on the form)
Use the live screenshots in /workspace/hackathons/settle-shots/ (live-01-landing.png through live-08-mobile-settle.png). These files are not in the GitHub repo; attach them on Devpost at submit time.

## Sponsor tools used (select on the form)
- AG Grid

Eligible for the Best Use of AG Grid prizes (Community features only, no Enterprise, no license key). Also eligible for the overall and honorable mention prizes, including Best Use of PayPal + AI and Best Use of Agentic Commerce. Do not select APIMatic, Bryntum, Channel3, or Render.

## Built with
paypal-payouts-api, paypal-orders-api, paypal-invoicing-api, paypal-js-sdk, ag-grid, ag-charts, openrouter, nemotron, next.js, react, typescript, zod, vitest, tailwind-css, vercel

## About the project (The story)

### Inspiration
After every small show, a promoter and a tour manager sit in a back office at 1 AM and settle up. They count tickets, take out refunds, apply a deal like "$1,500 guarantee vs 80% of net after expenses, expenses capped at $3,200, $250 bonus at 350 tickets, venue keeps 15% of merch, minus the $500 deposit", and then pay the headliner, the support act, the opener, the sound engineer, security and the door. It is done on paper or in a spreadsheet, mistakes are common, and people wait days to get paid. Independent venues and DIY promoters run this every week without a back office.

### What it does
Settle runs the whole night in four steps.

1. **Deal.** Paste the offer email. The AI extracts each act's deal (flat, versus, plus or door, with guarantee, percentage, expense cap, ticket bonuses, merch split and deposit). Every term carries the exact quote it came from, and Settle checks that each quote and each dollar figure really appears in the email. Anything that does not match is flagged for the promoter. The terms land in an editable AG Grid.

2. **Night of.** Fans buy tickets with PayPal Checkout (JS SDK Smart Buttons, orders created and captured on the server with Orders v2). Sales chart, orders grid with one-click PayPal refunds, and editable grids for expenses and crew day rates.

3. **Settle.** The server re-checks every PayPal ticket order with the Orders API and drops anything PayPal does not confirm. Then tested TypeScript applies every deal, cap, bonus, merch split and deposit, with a formula on every line. The AI writes each person a short plain English note, and any note that mentions a number not on the sheet is thrown out and replaced with a template.

4. **Pay.** The agent proposes a plan with three tools: pay_batch, hold and send_invoice. Guardrails check it: it can only pay people the policy allows and it never sets an amount. Server policy checks run again (per-payee cap, duplicate email, funds collected, two different approvers above a threshold). Then one PayPal Payouts batch pays everyone with an idempotent sender_batch_id, and each payout status streams into the grid. The promoter's share of the bar goes to the venue as a PayPal invoice.

The live demo currently runs PayPal through a clearly labeled mock. The header and every payment card say "MOCK PayPal". The mock uses the same adapter interface and the same PayPal status names as the sandbox implementation, so the checkout, refund, settlement, payout batch and invoice flows still work end to end. It is not a design mockup. It is a working build with a labeled stand-in for PayPal's sandbox APIs, plus a real sandbox adapter in the repo that is used when sandbox credentials are set.

### How we built it
- **PayPal:** Orders v2 (create, capture, get for reconciliation), Payouts v1 (create batch, get batch), Invoicing v2 (create, send, get), Payments v2 refunds, OAuth client credentials, and the PayPal JS SDK for checkout. All calls target api-m.sandbox.paypal.com. Live PayPal is never used. One adapter interface has a real sandbox implementation and a clearly labeled mock. The hosted demo is in mock mode until sandbox app credentials are configured.

- **AI:** free open models through OpenRouter (default nvidia/nemotron-3-ultra-550b-a55b:free with two fallbacks) for deal extraction, payee notes and the payout plan. Outputs are parsed with zod and checked against the memo and the computed settlement. Every AI step has a deterministic rules fallback, and the UI always shows which one ran (the model name, or that the labeled rules fallback ran).

- **AG Grid:** AG Grid Community and AG Charts Community. See the sponsor notes below for the exact features and file paths.

- **App:** Next.js 16, React 19, TypeScript, zod, Tailwind, Vitest, hosted on Vercel. This is a new project, built during the submission period (started Nov 9, 2026).

### Challenges we ran into
Keeping the AI useful without letting it touch money. The model reads and explains, but amounts only come from the settlement code, and the server recomputes the settlement and the policy before a payout or invoice is sent, so the browser cannot change a number. Free models also time out or run out of daily quota, so every AI step falls back to deterministic code instead of failing the night. That fallback is labeled in the UI so nobody mistakes a rules result for a model result.

### Accomplishments that we're proud of
- The whole settlement loop works end to end: memo, tickets, reconciliation, settlement sheet, approvals, one payout batch, invoice and refunds.
- 43 automated tests cover versus, plus, door and flat deals, caps, bonuses, merch, deposits, tax, guardrails, AI grounding and the PayPal request format.
- Every number on the sheet shows its formula.
- The PayPal integration is central, not decorative: checkout, order capture, reconciliation, refunds, a payouts batch and an invoice all go through the same adapter.

### What we learned
Agentic payments need a clear split of duties. Let the model plan and explain, let code compute, let policy decide, and let a person approve.

### What's next for Settle
Webhooks for payout status, settlement PDFs for each act, multi-show tours, and venue accounting exports. Connecting the hosted demo to the real PayPal sandbox (already implemented behind the same adapter) so judges can buy a ticket and see sandbox payout statuses without the mock label.

## Judging criteria map
- **Technological implementation:** six PayPal surfaces (JS SDK checkout, Orders create, capture and get, Payouts, Invoicing, Refunds); AI for extraction, explanation and planning, each verified; server-side recomputation; 43 tests.
- **Design:** one complete flow in four steps with a live agent activity log, editable grids, and clear empty, error, stale and mock states.
- **Potential impact:** independent venues and promoters settle every show by hand and acts wait days to get paid; Settle pays everyone the same night with an audit trail.
- **Innovation:** an AI agent that moves money inside explicit guardrails (policy-only payees, no model-set amounts, dual approval, idempotent batches, reconciliation against PayPal).
- **Presentation:** video under 3 minutes showing the whole night end to end.

## Testing instructions (for judges)
Open https://settle-eight-khaki.vercel.app/show. No login. Step 1: click "Read the deal memo", then "Use these terms". Step 2: buy a ticket with the PayPal button. Step 3: click "Settle the show" and click any row to see the math and the AI note. Step 4: type a second approver name and click "Pay 6 people". The header shows whether PayPal is in sandbox or MOCK mode and which AI model ran (or that the rules fallback ran). "Reset demo" restores the starting show. Run locally with the steps in the README.

In the current hosted demo, the header and payment cards say "MOCK PayPal". Ticket checkout, refunds, the payout batch and the bar invoice still complete, with PayPal status names, through the labeled mock adapter. If you run it locally with PayPal sandbox credentials (README: developer.paypal.com, Apps & Credentials, Sandbox REST app), the header switches to sandbox and those same actions hit the sandbox APIs. Payee emails in the demo use example.com; in the sandbox, replace them with sandbox personal account emails in the Deal and Night of grids to see SUCCESS instead of UNCLAIMED.

## Tools used (required: identify AI tools and how they were used)

### AI disclosure
- **Runtime AI:** free open models on OpenRouter (default nvidia/nemotron-3-ultra-550b-a55b:free; fallbacks nvidia/nemotron-3.5-super-vl:free and google/gemma-4-31b-it:free) for deal memo extraction, payee notes and the payout plan. If no key is set, a model times out, or the free daily quota is used up, every AI step falls back to deterministic rules, and the UI labels that fallback.
- **Development:** Settle was built with Grok Bot, an AI coding assistant, which wrote much of the code and the submission text under human direction.
- **Video:** the voiceover is a synthetic text-to-speech voice (Piper), disclosed on screen. No copyrighted music.
- **Demo data:** all names are invented, and the advance ticket crowd is simulated and labeled as such.

## AG Grid sponsor notes (Best Use of AG Grid)

Settle uses AG Grid Community and AG Charts Community only (MIT). No Enterprise features and no license key. Packages: ag-grid-community and ag-grid-react (^36.3.0), ag-charts-community and ag-charts-react (^14.3.0), declared in package.json.

AG Grid Community features, with file paths:

- Shared grid wrapper and custom dark "backstage" theme from the Theming API: themeQuartz.withPart(colorSchemeDarkWarm).withParams(...) in src/components/grid.tsx. AllCommunityModule is registered there. animateRows is on for every grid.
- Editable deal grid with validating value setters that convert dollars to integer cents, plus valueGetter, valueFormatter, pinned left column, and cellClassRules for missing PayPal emails: src/components/steps/deal-step.tsx.
- Night-of orders grid with custom cell renderers (source and status pills, a Refund button), valueFormatter, pagination (paginationPageSize={50}), and editable expense and crew grids with the same validating money value setters: src/components/steps/night-step.tsx.
- Settlement sheet in src/components/steps/settle-step.tsx:
  - pinnedBottomRowData for a totals row
  - custom pill cellRenderer for deal outcomes
  - tooltipValueGetter on the Earned column (formula tooltips, tooltipShowDelay={200})
  - valueFormatter on money columns
  - defaultColDef with filter and sortable
  - preset views driven by the grid API: setFilterModel and applyColumnState
  - CSV export via exportDataAsCsv
  - rowSelection with click selection, onRowClicked, onGridReady, getRowId
  - autoSizeStrategy type fitGridWidth
  - a left-pinned Payee column
- Payout grid that flashes status changes as they stream in (enableCellChangeFlash) and a custom status cellRenderer: src/components/steps/pay-step.tsx.

AG Charts Community features, all in src/components/charts.tsx, using AllCommunityModule and a custom ag-default-dark theme:

- Money waterfall built from stacked bar series (invisible base plus up, down and total segments): WaterfallChart.
- Payee donut (angleKey, legendItemKey, sectorLabelKey, innerRadiusRatio): PayeeDonut.
- Stacked daily ticket sales by source (advance, PayPal Checkout, door): SalesChart, used from src/components/steps/night-step.tsx. Chart data helpers live in src/lib/chart-data.ts.

## Swap-in paragraph: when the live demo uses real PayPal sandbox

Replace the mock-mode sentences in "What it does", "How we built it", and "Testing instructions" with the paragraph below, and delete the two sentences that say the hosted demo is in mock mode. Keep the rest of the story as is.

SWAP-IN: The hosted demo at https://settle-eight-khaki.vercel.app/show now talks to the real PayPal sandbox (api-m.sandbox.paypal.com). The header reads sandbox, not MOCK. Ticket checkout, capture, refunds, settlement reconciliation, the Payouts batch and the bar invoice are live sandbox API calls. The labeled mock adapter remains in the repo as a fallback when credentials are absent. To see payout SUCCESS instead of UNCLAIMED, replace the example.com payee emails in the Deal and Night of grids with sandbox personal account emails, as described in the README.

## Submit-time checklist
- [ ] Confirm the Devpost dashboard has no existing Settle submission (do not double-submit).
- [ ] Upload settle-demo.mp4 to YouTube as Public, then replace YOUTUBE_URL.
- [ ] Attach live screenshots from /workspace/hackathons/settle-shots/.
- [ ] If sandbox credentials are live, use the swap-in paragraph and re-check the demo header before pasting.
- [ ] If still in mock mode by Wednesday midday, submit in labeled mock mode (this draft) before Thursday, Nov 12, 3:00 PM EST.
- [ ] Select AG Grid as a sponsor tool.
- [ ] Recheck that https://github.com/Joe-Simo/settle is public and shows the MIT license in About.
