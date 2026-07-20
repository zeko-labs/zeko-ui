---
id: T469
title: "poll-while-local-pending-transactions-exist"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Bridge machine refresh guard must keep polling when locally persisted pending transactions exist for the current wallet and bridge network pair.
- This covers pending rows that are visible after submit/refresh before an indexed/recovered operation actor exists.
- Avoid side effects in the guard beyond reading pending storage.
- Preserve existing polling behavior for in-machine operations.
- Do not commit or push.

## Test Plan

- TDD.
- Add unit coverage for detecting scoped local pending transactions.
- Run focused bridge-ui tests plus typecheck/lint/format.

## RED Evidence

- `shouldRefreshPendingOperations` only checks `context.operations`, so visible local pending rows can stop polling until refresh/manual action.

## GREEN Evidence

- Added `hasPendingBridgeTransactions` to query scoped local pending storage without cleanup writes.
- Updated bridge `shouldRefreshPendingOperations` to keep polling when scoped local pending records exist even if no machine operation actor exists yet.
- Added regression coverage for local pending records triggering polling and unrelated records not triggering polling.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-refresh-queue.test.ts test/unit/pending-transactions.test.ts` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
