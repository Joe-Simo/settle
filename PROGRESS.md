# Settle progress log (times ET)

## Done
- Nov 9 1:30 PM: rules and updates re-checked (curl). No rule changes. Updates: upload video early; after the deadline do not touch repo, README or video; keep demo and sandbox creds active until winners.
- Nov 9 2:25 to 3:00 PM: full app built. Engine, policy, PayPal sandbox adapter + labeled mock, AI extraction/notes/plan with grounding, 9 API routes, 4-step dashboard with AG Grid Community + AG Charts Community. 43 tests, typecheck, lint, build pass.
- Nov 9 3:00 PM: local API E2E passed (mock PayPal, live OpenRouter nemotron-3-ultra free): extract (no warnings), order + capture, settle (fake order dropped by reconcile), dual approval enforced (403 on same name), payout batch PENDING then SUCCESS, bar invoice SENT, refund COMPLETED, bad input 400.

- Nov 9 3:05 PM: repo https://github.com/Joe-Simo/settle public, MIT detected. Vercel project simo-js/settle (CLI link + git connect), live https://settle-eight-khaki.vercel.app, push to main auto-deploys.
- Nov 9 3:07 PM: live headless UI E2E passed (all 4 steps, mobile overflow 0, no console errors). Screens in /workspace/hackathons/settle-shots/live-*.png.
- Nov 9 3:10 PM: submission/form-fields.md written; draft-check PASS.
- Nov 9 3:15 to 3:30 PM: live API E2E (mock PayPal) passed: order+capture, reconcile drops fake order, 403 on one approver, payout PENDING to SUCCESS x6, invoice SENT, refund COMPLETED, bad show 400. AI: from Vercel the free models often time out (from the box they answer in 3 to 6 s); every AI step fell back cleanly. llm.ts now times out the whole response at 20 s and tries each model in turn within 40 s, and reports each attempt in the note.

- Nov 10 9:17 AM: PayPal sandbox keys on the box and on Vercel (prod + preview); live /api/status reports paypal sandbox.
- Nov 10 9:23 to 9:45 AM: first live sandbox E2E found 3 sandbox-only problems, fixed in 3ad9983 (deployed 49b6c12, READY, https://settle-6396fup0t-simo-js.vercel.app aliased to settle-eight-khaki):
  1. Server capture of an order nobody approved returns 422 ORDER_NOT_APPROVED. Added POST /api/orders/[id]/test-card (Orders confirm-payment-source with PayPal's public sandbox test Visa) and a "Pay with a PayPal sandbox test card" button next to the Smart Buttons, so judges can buy without a sandbox login.
  2. sender_batch_id was a pure hash of the settlement, so a second visitor with the same show would collide with the first batch on PayPal. Show now carries a per-session runId (set on load and on Reset) that goes into the hash; retries in one session still reuse the id.
  3. PayPal errors now carry a plain hint for NOT_AUTHORIZED (feature off on the sandbox app) and INSUFFICIENT_FUNDS (sandbox balance too low).
  45 tests, typecheck, lint, build pass.
- Nov 10 9:41 AM live sandbox E2E on https://settle-eight-khaki.vercel.app (proof, real sandbox IDs):
  - extract 200 (rules fallback, the free model timed out from Vercel), 3 acts
  - order 76D72480VJ002074T created; capture before approval 422 ORDER_NOT_APPROVED; test-card route APPROVED; capture COMPLETED 44.00 USD, capture 8JX39230CG168605Y
  - settle: reconcile kept 76D72480VJ002074T (COMPLETED, 44.00 USD) and dropped fake order 5O190127TN364715T (INVALID_RESOURCE_ID); 382 tickets; 6 payable; 2 approvals; notes and plan by the model
  - payouts with one approver name twice: 403 "Two different approvers are required."
  - refund of 8JX39230CG168605Y: 9CT07650NX755414K COMPLETED
  - bad show: 400
  - payout batch (live /api/payouts, 2 payees under a $200 cap variant, $310): payout_batch_id KDMAVL9YCW47U, PENDING then PROCESSING then SUCCESS in about 30 s; items UNCLAIMED (example.com receivers have no sandbox account), transaction ids 6V483048UN734940N and 7DG54780Y5345723E
  - full demo batch (6 payees, $7,483): 422 INSUFFICIENT_FUNDS
  - invoice: 403 NOT_AUTHORIZED (the sandbox REST app token has no invoicing scope)
- Nov 10 9:35 AM: tried to raise the sandbox balance with a $40,000 sandbox test-card capture (order 0FG58674U24881214, capture 2W7984911R603554W, net 38,963.51, sandbox money only) plus a tracking record. Payouts still say INSUFFICIENT_FUNDS, so PayPal keeps those funds unavailable. Probe batches BSDZJXHWECMBS ($1), DRURUHGSF2CQ8 ($50), 2AU7CFZ37CZPG ($500) went through; $3,000 did not.
- Nov 10 9:45 AM: submission/form-fields.md rewritten for real sandbox mode (mock caveat and swap-in section removed, sandbox IDs added, two dashboard prerequisites in the checklist). draft-check PASS. README notes the test-card button and per-session batch ids.

## Next
- Demo video (Remotion + Piper) from a live capture, mp4 to submission/. Then final report.

## Blockers
- Joe-only (PayPal developer dashboard sign-in): (1) raise the PayPal balance of sandbox business account sb-g8vjo53819931@business.example.com (Sandbox accounts, edit) to $100,000 or more, since each full demo batch is $7,483; (2) turn on Invoicing for the sandbox REST app (Apps & Credentials, the app, Features). Until then the full step 4 batch returns INSUFFICIENT_FUNDS and the bar invoice returns NOT_AUTHORIZED on the hosted demo.
- Video re-capture in sandbox waits on (1): a capture now would show the step 4 error. Run it after the balance is raised.
- OpenRouter free models are slow or time out from Vercel at times; app falls back to rule parser, template notes and rule plan, and labels it.
- Dependabot: 1 moderate (minimatch, dev only).

## Video checkpoints (Nov 9)
- [done 3:10 PM] Capture of live site: /workspace/video-pipeline/settle/capture/app.mp4 (151 s, 1920x1080, marks in capture/marks.json). PayPal MOCK; AI fell back to rules/templates during this capture (narration says so).
- [done 3:40 PM] Narration: settle/script.json + settle/vo/s00..s11.wav (Piper ljspeech, 158 s total).
- [done 3:42 PM] Composition rtest/src/Settle.tsx (id Settle, 4756 frames), assets in rtest/public/settle.
- [blocked 4:40 PM] Remotion render: under load 160 to 250 Chrome could not even start (25 s browser connect timeout); 40 min produced no chunk. Remotion composition kept for a later re-render (cd rtest; N=4756 CONC=1 bash ../settle/render-chunks.sh).
- [in progress 4:50 PM] Fallback render with ffmpeg only (no browser), same layout, captions and synthetic voice label: settle/build_ff.py renders one file per segment into settle/ff/ (re-run skips finished segments), then concat to submission/settle-demo.mp4.
- [done 5:51 PM] Final video: submission/settle-demo.mp4 (2:38.6, 1920x1080 h264 + AAC, 10.5 MB), concat of settle/ff/s00..s11 rendered with ffmpeg (build_ff.py). Synthetic voice label on every scene, captions, no music, sample data note. Gitignored and not uploaded anywhere (brief: do not upload).
- Video caveat: captured while PayPal was MOCK and the free AI models had fallen back; narration says both. Re-capture after sandbox keys land: node settle/capture.cjs, update clip times in settle/script.src.json from capture/marks.json, python3 tts.py if text changes, rm settle/ff/*.mp4, python3 build_ff.py, then concat (settle/ff/list.txt).
