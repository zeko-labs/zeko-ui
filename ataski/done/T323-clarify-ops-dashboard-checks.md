---
id: T323
title: "Clarify ops dashboard checks"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-11T04:08:00Z
updated_at: 2026-06-10T19:11:59Z
---

## Requirements

- Replace the misleading `coverage scan partial` wording with an explicit indexer lag label.
- Stop presenting the summary counts as raw service-probe counts when the visible dashboard also shows derived operational checks.
- Make the summary counts match the visible operational checks so OK/Warn/Error/Unknown are understandable at a glance.

## Test Plan

- DDD: inspect the current UI derivations, update the dashboard computed state, and validate with typecheck/lint/test before deploy.

## RED Evidence

- `coverageFromHeights` marks any archive/indexer height gap as `partial`, but this client path does not scan archive action rows.
- `displayedSummary` reads `snapshot.summary`, which only counts backend services and does not include the visible finality/coverage/tail/gap cards.

## GREEN Evidence

- `coverage scan partial` was replaced with `indexer behind archive head`, with detail text that names archive head and indexer fetched height.
- OK/Warn/Error/Unknown counts now summarize the visible dashboard checks, including service probes, finality, indexer lag, pending-finality tail, and archive/daemon alignment.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:test` passed.
- `moon run ops-dashboard:deploy` passed and deployed Worker version `08d83d92-e058-40d2-883b-9695c0360d51`.
- Live validation behind a temporary Cloudflare Access IP bypass passed for testnet and mainnet: status API returned, token endpoint returned a token, action-indexer `/health` and `/status` returned HTTP 200, DB status was `up`, indexer status was `running`, and consecutive errors were `0`.
