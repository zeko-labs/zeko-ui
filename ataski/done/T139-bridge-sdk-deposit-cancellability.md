---
id: T139
title: "Bridge SDK per-deposit cancellability"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T14:10:18Z
updated_at: 2026-03-19T14:19:19Z
---

## Requirements

- Restrict the change to `packages/bridge-sdk`; do not modify any other project.
- Extend the public `DepositWithState` type with a new additive `cancellable: boolean` field.
- Update `Bridge.fetchDepositsWithStates(pk)` so each returned deposit reports exact per-deposit cancellability using the SDK's real witness/rejection logic, not a timeout-only heuristic.
- Support multiple cancellable queued deposits at the same time.
- Ensure deposits already marked `cancelled` or `finalised` are never reported as `cancellable`.
- Keep existing public methods working, including `canCancelDeposit(pk)`, preferably by reusing the same per-deposit computation.

## Test Plan

- DDD
- Add focused `bridge-sdk` unit coverage in the existing `packages/bridge-sdk/test/diagnostics.test.ts` entrypoint by stubbing bridge internals and utility fetchers with synthetic witness/action timelines.
- Cover one cancellable deposit, multiple cancellable deposits, pending-but-not-cancellable deposits, accepted/finalisable deposits not marked cancellable, and cancelled/finalised deposits not marked cancellable.
- Validate from the repo root with `moon run bridge-sdk:build -u`, `moon run bridge-sdk:typecheck -u`, and `moon run bridge-sdk:test -u`.

## RED Evidence

- Initial `moon run bridge-sdk:test` run failed in the new `canCancelDeposit` assertions because the test-only `fetchAccount` mock only provided two one-shot return values and the second SDK call fell through to the real private method. Tightened the mock with a default resolved value before re-running validation.

## GREEN Evidence

- Added `cancellable: boolean` to the public `DepositWithState` type and populated it from the SDK's existing witness/rejection cancellation source of truth.
- Refactored `Bridge` deposit state fetching to build a shared deposit context that is reused by both `fetchDepositsWithStates(pk)` and `canCancelDeposit(pk)`.
- `fetchDepositsWithStates(pk)` now marks every eligible rejected deposit as cancellable, supports multiple cancellable deposits at once, and forces `cancellable: false` for cancelled and finalised deposits.
- Added focused unit coverage in `packages/bridge-sdk/test/diagnostics.test.ts` for:
  - one cancellable deposit
  - multiple cancellable deposits
  - pending non-cancellable deposits
  - accepted deposits not marked cancellable
  - cancelled deposits not marked cancellable
  - finalised deposits not marked cancellable
  - `canCancelDeposit(pk)` staying aligned with per-deposit cancellability
- Validation:
  - `moon run bridge-sdk:build`
  - `moon run bridge-sdk:typecheck`
  - `moon run bridge-sdk:test`
  - `moon run bridge-sdk:lint` completed with two pre-existing `noExplicitAny` warnings on `ExtractInput` in `packages/bridge-sdk/src/types.ts`
