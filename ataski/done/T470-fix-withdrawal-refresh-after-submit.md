---
id: T470
title: "fix-withdrawal-refresh-after-submit"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-16T14:44:35Z
updated_at: 2026-07-16T14:55:00Z
---

## Requirements

- Investigate withdrawal-only refresh behavior after submitting and signing a withdrawal request.
- Deposit flow must not show an unrelated withdrawal queue panel; withdrawal queue rendering should be intentional and consistent with product state.
- After a signed withdrawal moves from awaiting finalization to awaiting claim, the UI must automatically refresh the main bridge card, withdrawal queue, and transaction history without requiring manual refresh.
- The main screen must update to the expected confirmation/claim-ready state (for example, one confirmation remaining when that is the real bridge state).
- Preserve existing deposit refresh behavior and pending transaction persistence.
- Avoid making debug/mock logic hide real bridge state bugs.

## Test Plan

- TDD/DDD hybrid.
- First reproduce the missing refresh at the smallest executable boundary: unit tests for bridge refresh queue/pending transaction polling and transaction table/main-card data derivation.
- Add or adjust tests so withdrawal local pending state transitions trigger refresh while deposits remain unaffected.
- Validate with focused bridge-ui tests and typecheck.

## RED Evidence

- User live repro: after signing a withdrawal request, the UI shows the withdrawal in a queue-like panel and does not automatically refresh the main card, withdrawal queue, or transactions when the operation becomes claimable.
- Code inspection: `bridgeOperationMachine` saves a local pending withdrawal and transitions through withdrawal pending/claimable states, but it does not notify the parent bridge machine to run `RefreshOperations`; parent refresh is left to the 20s polling interval.
- Add failing unit coverage that a signed withdrawal submission should request a parent refresh immediately.

## GREEN Evidence

- `bridgeOperationMachine` now requests parent `RefreshOperations` immediately after deposit/withdrawal submit transactions are persisted locally.
- Pending withdrawals now request parent `RefreshOperations` as soon as they become claimable or are reported already finalised, so the main card, queues, and transactions do not wait for the 20s parent polling interval.
- Added unit coverage for parent refresh after signing a withdrawal and when a withdrawal becomes claimable.
- `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operation.test.ts -t "requests a parent refresh"` passed.
- `nix develop --command pnpm exec moon run bridge-ui:typecheck -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:lint -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:format -f` passed.
- Broader `bridge-operation.test.ts` plus `bridge-refresh-queue.test.ts` run hit an existing isolated `passes cloneable worker payloads when finalizing a deposit` timeout/window-stub issue; the new focused withdrawal refresh tests passed.
