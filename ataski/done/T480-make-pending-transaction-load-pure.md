---
id: T480
title: "make-pending-transaction-load-pure"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-20T10:42:00Z
updated_at: 2026-07-20T10:44:00Z
---
## Requirements

- Address review feedback in `apps/bridge-ui/machines/pendingTransactions.ts`.
- Make `loadPendingBridgeTransactions` a pure read operation with no synchronous localStorage writes.
- Preserve scoped filtering behavior.
- Keep stale cleanup on write paths (`savePendingBridgeTransaction`, `reconcilePendingBridgeTransactions`).
- Do not push.

## Test Plan

- TDD.
- Add/update pending transaction persistence coverage proving `loadPendingBridgeTransactions` does not write to storage while still returning scoped records.
- Validate with pending transaction unit tests, typecheck, lint, and format.

## RED Evidence

- Added regression coverage for load purity. `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-transactions.test.ts -t "does not write to storage when loading records"` failed because `loadPendingBridgeTransactions` called `setItem` once.

## GREEN Evidence

- Changed `loadPendingBridgeTransactions` to return filtered `readStore(options).records` without writing to storage.
- Added regression coverage proving load does not call `setItem`.
- `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-transactions.test.ts` passed.
- `nix develop --command pnpm exec moon run bridge-ui:typecheck -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:lint -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:format -f` passed.
