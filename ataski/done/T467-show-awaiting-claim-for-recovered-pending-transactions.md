---
id: T467
title: "show-awaiting-claim-for-recovered-pending-transactions"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Transaction history pending local rows should show `Awaiting inclusion` only before the bridge operation is recovered/indexed.
- Once the same transaction hash is recovered/indexed and is waiting on the claim step, the local row should show `Awaiting claim`.
- Keep the local row until a real history/completed row replaces it.
- Do not commit or push.

## Test Plan

- DDD.
- Add/adjust unit coverage for pending row status text.
- Run focused bridge-ui tests, typecheck, lint, and format.

## RED Evidence

- User observed `Awaiting inclusion` remains misleading once the center claim flow appears.

## GREEN Evidence

- Extended pending transaction status with `awaiting-claim`.
- Transaction history rows now show `Awaiting claim` when the locally persisted transaction hash matches a recovered/indexed current or queued operation.
- Local pending rows still stay until a completed/history row replaces them.
- Added unit coverage for `Awaiting claim` row mapping.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-transactions.test.ts test/unit/bridge-operations-table.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
