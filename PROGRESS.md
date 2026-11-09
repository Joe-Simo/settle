# Settle progress log (times ET)

## Done
- Nov 9 1:30 PM: rules and updates re-checked (curl). No rule changes. Updates: upload video early; after the deadline do not touch repo, README or video; keep demo and sandbox creds active until winners.
- Nov 9 1:40 PM: scaffold config copied from rerun (Next 16.4.3, React 19.3.1, Vitest, eslint).

## Next
- money, schema, settlement engine, policy, tests
- PayPal gateway (sandbox REST + mock), API routes, UI with AG Grid Community + AG Charts Community
- README, submission form fields, video plan

## Blockers
- No PayPal sandbox credentials on the box (none in /home/box/.secrets or /workspace/hackathons). App runs in labeled MOCK mode until PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET exist.
- Box load 200 to 370, inodes about 90 to 99 percent used, npm registry EPROTO errors at 1:40 PM.
