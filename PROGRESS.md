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

## Video checkpoints (Nov 9)
- [done 3:10 PM] Capture of live site: /workspace/video-pipeline/settle/capture/app.mp4 (151 s, 1920x1080, marks in capture/marks.json). PayPal MOCK; AI fell back to rules/templates during this capture (narration says so).
- [done 3:40 PM] Narration: settle/script.json + settle/vo/s00..s11.wav (Piper ljspeech, 158 s total).
- [done 3:42 PM] Composition rtest/src/Settle.tsx (id Settle, 4756 frames), assets in rtest/public/settle.
- [blocked 4:40 PM] Remotion render: under load 160 to 250 Chrome could not even start (25 s browser connect timeout); 40 min produced no chunk. Remotion composition kept for a later re-render (cd rtest; N=4756 CONC=1 bash ../settle/render-chunks.sh).
- [in progress 4:50 PM] Fallback render with ffmpeg only (no browser), same layout, captions and synthetic voice label: settle/build_ff.py renders one file per segment into settle/ff/ (re-run skips finished segments), then concat to submission/settle-demo.mp4.
- [done 5:51 PM] Final video: submission/settle-demo.mp4 (2:38.6, 1920x1080 h264 + AAC, 10.5 MB), concat of settle/ff/s00..s11 rendered with ffmpeg (build_ff.py). Synthetic voice label on every scene, captions, no music, sample data note. Gitignored and not uploaded anywhere (brief: do not upload).
- Video caveat: captured while PayPal was MOCK and the free AI models had fallen back; narration says both. Re-capture after sandbox keys land: node settle/capture.cjs, update clip times in settle/script.src.json from capture/marks.json, python3 tts.py if text changes, rm settle/ff/*.mp4, python3 build_ff.py, then concat (settle/ff/list.txt).
