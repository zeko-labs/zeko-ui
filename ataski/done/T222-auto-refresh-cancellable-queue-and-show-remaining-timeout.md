---
id: T222
title: "Auto-refresh cancellable queue and show remaining timeout"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-25T11:55:52Z
updated_at: 2026-03-25T12:05:52Z
---

## Requirements

- Update bridge-ui so recovered deposit cards automatically reflect when a queued deposit becomes cancellable while the page remains open.
- Keep the implementation inside the existing XState architecture. Do not add ad hoc Vue timers or bypass the bridge machines.
- Replace raw timeout-slot metadata in queued deposit cards with a human-readable remaining timeout derived from the latest current slot.
- Keep the refresh scoped to the queue/cancellation behavior. Do not rebuild or rehydrate active bridge operations on a timer.
- Preserve submission-order queue execution and the existing main-lane versus cancellation-lane split.

## Test Plan

- TDD
- Add pure-unit coverage for remaining-time formatting and recovery-sync behavior before implementation.
- Add machine-level coverage for paused recovered deposits updating to `canCancel` through an XState event path rather than a direct component-side workaround.
- Re-run `moon run bridge-ui:test` and `moon run bridge-ui:typecheck`.

## RED Evidence

- `moon run bridge-ui:typecheck` initially failed in the worktree because `currentSlot` was threaded into the queue components without being destructured from `defineProps`.
- The new queue-helper expectation for the local timeout window also failed because the formatter intentionally uses the same `Times out in ...` copy for both recovered and locally configured timeouts.

## GREEN Evidence

- Added a bridge-level refresh loop in `READY` that performs one periodic `findPendingOperations` poll and reconciles existing actors instead of recreating them.
- Added recovery-sync coverage for paused-vs-started deposits moving between the main and cancellation lanes while preserving serialized `operationsToUnpause`.
- Added machine coverage for `SyncRecoveredState`, including:
  - paused recovered deposits becoming cancel-ready without leaving `PAUSED`
  - pending deposits transitioning to `CAN_CANCEL` when refreshed cancellability arrives
- Replaced raw timeout-slot metadata with remaining-time metadata derived from `currentSlot`.
- Validation in the canonical worktree:
  - `moon run bridge-ui:test`
  - `moon run bridge-ui:typecheck`
