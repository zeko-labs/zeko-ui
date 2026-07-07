---
id: T457
title: "implement-bridge-pending-persistence"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-06T00:00:00Z
updated_at: 2026-07-06T00:00:00Z
---

## Requirements

- Implement task 03 from `.planning/features/003-bridge-ui-local-pending-transactions/tasks/03-implement-pending-transaction-persistence.md`.
- Add a typed browser `localStorage` persistence helper for pending bridge transactions in `apps/bridge-ui/`.
- Use storage key `zeko.bridge.pendingTransactions.v1` and schema version `1`.
- Persist only non-secret display/recovery metadata: wallet address, L1/L2 networks, source/destination networks, direction, amount, transaction hash, submitted timestamp, optional operation id and timeout slots, and status `awaiting-inclusion`.
- Save a pending record only after submit deposit or submit withdrawal succeeds and returns a transaction hash.
- Provide load/filter helpers scoped by wallet, network pair, and optionally direction.
- Provide reconciliation/delete helpers keyed by transaction hash for the later merge/display task.
- Treat malformed/unavailable storage as empty and do not fail bridge submission if persistence write fails.
- Do not implement the merged UI display in this task.

## Test Plan

- TDD.
- RED path: add unit tests for the pending transaction persistence helper before implementation.
- Tests must cover save/load by wallet/network scope, malformed storage fallback, stale cleanup, and reconciliation by transaction hash.
- After helper tests are red, implement the helper and bridge operation save hook, then run the focused bridge-ui unit tests through Moon.

## RED Evidence

- `./node_modules/.bin/moon run bridge-ui:test -- test/unit/pending-transactions.test.ts` failed before executable tests because Playwright browser was not installed.
- `./node_modules/.bin/moon run bridge-ui:playwright-install` failed because the task requires sudo for OS dependencies in this harness.
- After switching the focused helper test to a Node-compatible storage seam, `./node_modules/.bin/moon run bridge-ui:test -- --browser.enabled=false test/unit/pending-transactions.test.ts` failed with a pending transaction persistence assertion before final fixes.

## GREEN Evidence

- `./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/pending-transactions.test.ts` passed: 6 tests.
- `./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `./node_modules/.bin/moon run bridge-ui:typecheck` failed on existing environment/config resolution for `node:path` and `node:url` before checking this change.
