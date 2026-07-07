---
id: T462
title: "skip-empty-pending-reconcile-writes"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Address review feedback in `apps/bridge-ui/machines/pendingTransactions.ts` only if valid.
- Avoid writing to localStorage from `reconcilePendingBridgeTransactions` when no pending records match and no records are removed.
- Preserve existing reconciliation behavior when records are removed.
- Do not commit or push.

## Test Plan

- TDD.
- Add a focused unit test that reconciliation with no matching transaction hash does not call `setItem` again.
- Run the focused pending transaction tests and bridge-ui lint.

## RED Evidence

- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-transactions.test.ts` failed after adding the no-op reconciliation write test because `setItem` was called once.

## GREEN Evidence

- Added a no-op reconciliation test in `apps/bridge-ui/test/unit/pending-transactions.test.ts`.
- Updated `reconcilePendingBridgeTransactions` to return before `writeStore` when no records are removed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-transactions.test.ts` passed: 7 tests.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
