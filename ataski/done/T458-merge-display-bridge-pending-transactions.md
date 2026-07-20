---
id: T458
title: "merge-display-bridge-pending-transactions"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-06T00:00:00Z
updated_at: 2026-07-06T00:00:00Z
---

## Requirements

- Implement task 04 from `.planning/features/003-bridge-ui-local-pending-transactions/tasks/04-merge-and-display-pending-transactions.md`.
- Display persisted pending-only bridge transactions in the existing completed transaction table after refresh.
- Use the existing `PendingBridgeTransaction` records from `apps/bridge-ui/machines/pendingTransactions.ts`.
- Merge fetched SDK-backed operations and persisted pending records by transaction hash.
- If a fetched SDK operation has the same transaction hash as a pending record, render only the fetched SDK-backed row and reconcile/remove the pending record.
- Pending-only rows must show status text `Awaiting inclusion` and preserve existing table columns/order as much as possible.
- Pending records must be scoped by connected wallet and current L1/L2 bridge pair.
- Do not change bridge protocol, indexer finality, or finalization semantics.

## Test Plan

- TDD.
- RED path: add focused unit coverage for the pure table merge/row projection boundary before implementation.
- Tests should cover pending-only rows, duplicate pending/fetched rows preferring fetched, status label `Awaiting inclusion`, and wallet/network scoped pending load behavior where practical.
- After tests are red, implement merge/display logic and run the focused bridge-ui unit tests through Moon.

## RED Evidence

- `./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operations-table.test.ts` failed with missing `pendingBridgeTransactionRows` / merge implementation after adding tests.

## GREEN Evidence

- `./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operations-table.test.ts test/unit/pending-transactions.test.ts` passed: 13 tests.
- `./node_modules/.bin/moon run bridge-ui:lint -f` passed.
