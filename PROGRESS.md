# Settle progress log (times ET)

## Done
- Nov 9 1:30 PM: rules and updates re-checked (curl). No rule changes. Updates: upload video early; after the deadline do not touch repo, README or video; keep demo and sandbox creds active until winners.
- Nov 9 2:25 to 3:00 PM: full app built. Engine, policy, PayPal sandbox adapter + labeled mock, AI extraction/notes/plan with grounding, 9 API routes, 4-step dashboard with AG Grid Community + AG Charts Community. 43 tests, typecheck, lint, build pass.
- Nov 9 3:00 PM: local API E2E passed (mock PayPal, live OpenRouter nemotron-3-ultra free): extract (no warnings), order + capture, settle (fake order dropped by reconcile), dual approval enforced (403 on same name), payout batch PENDING then SUCCESS, bar invoice SENT, refund COMPLETED, bad input 400.

- Nov 9 3:05 PM: repo https://github.com/Joe-Simo/settle public, MIT detected. Vercel project simo-js/settle (CLI link + git connect), live https://settle-eight-khaki.vercel.app, push to main auto-deploys.
- Nov 9 3:07 PM: live headless UI E2E passed (all 4 steps, mobile overflow 0, no console errors). Screens in /workspace/hackathons/settle-shots/live-*.png.
- Nov 9 3:10 PM: submission/form-fields.md written; draft-check PASS.
- Nov 9 3:15 to 3:30 PM: live API E2E (mock PayPal) passed: order+capture, reconcile drops fake order, 403 on one approver, payout PENDING to SUCCESS x6, invoice SENT, refund COMPLETED, bad show 400. AI: from Vercel the free models often time out (from the box they answer in 3 to 6 s); every AI step fell back cleanly. llm.ts now times out the whole response at 20 s and tries each model in turn within 40 s, and reports each attempt in the note.

## Next
- Demo video (Remotion + Piper) from a live capture, mp4 to submission/. Then final report.

## Blockers
- No PayPal sandbox credentials. App runs in labeled MOCK mode; switching is env only: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET on Vercel (production + preview), then redeploy.
- OpenRouter free models are slow or time out from Vercel at times; app falls back to rule parser, template notes and rule plan, and labels it.
- Dependabot: 1 moderate (minimatch, dev only).
