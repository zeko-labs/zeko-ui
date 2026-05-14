---
id: T223
title: "Prefer cancel for started timed-out main operation"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-25T12:11:30Z
updated_at: 2026-03-25T12:25:52Z
---

## Requirements

- Keep a started deposit in the current-operation panel without duplicating it into the queued cancellation strip.
- When the SDK reports that the started deposit is cancellable, the operation machine must prefer the cancellation path over finalization.
- If the started deposit is already in `TO_FINALIZE` when refreshed cancellability arrives, it must transition back to the cancel-ready state.
- Preserve the existing rule that only paused cancellable deposits appear in the separate `Cancellable Deposits` queue.

## Test Plan

- TDD
- Add machine-level coverage for:
  - pending-deposit polling preferring `CAN_CANCEL` when both finalize and cancel are available
  - `SyncRecoveredState` moving a started deposit from `TO_FINALIZE` to `CAN_CANCEL`
- Re-run `moon run bridge-ui:test` and `moon run bridge-ui:typecheck`.

## RED Evidence

- The started timed-out deposit stayed in the main panel but remained on the finalize path because `pendingDeposit` preferred `CanFinalize` over `CanCancel`.
- A started deposit already in `TO_FINALIZE` ignored refreshed cancellability because that state had no `SyncRecoveredState` transition back to `CAN_CANCEL`.

## GREEN Evidence

- `pendingDeposit` now prefers `CanCancel` over `CanFinalize` when both are available.
- `TO_FINALIZE` now handles `SyncRecoveredState` and transitions to `CAN_CANCEL` when refreshed cancellability arrives.
- Added machine coverage for:
  - simultaneous finalize/cancel availability preferring cancellation
  - a started deposit moving from `TO_FINALIZE` to `CAN_CANCEL` on refresh
- Validation:
  - `moon run bridge-ui:test`
  - `moon run bridge-ui:typecheck`
