---
id: T393
title: "Verify completed bridge operations"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T08:17:04Z
updated_at: 2026-06-19T08:47:36Z
---

## Requirements

- Fix bridge-ui completion semantics so a successful finalize/claim transaction can release the main queue and appear in completed transactions, but remains visually unverified until `findPendingOperations` confirms the matching bridge action is terminal.
- Track the bridge action index on operation actors. Use `canFinalizeDeposit` / `canFinalizeWithdrawal` results only when their `index` matches the active operation's action index.
- For freshly submitted local operations that do not yet know their action index, bind the index from `findPendingOperations` by matching the recovered action's submit transaction hash.
- Add a yellow completed-transaction state for operations that have locally completed or received matching `alreadyFinalised`, but are not yet confirmed terminal by recovery.
- Upgrade the yellow state to verified completed only when `findPendingOperations` returns the matching operation with `finalised: true` or `cancelled: true`.
- Keep the fix bridge-ui only; do not change SDK, indexer, or Actions API semantics.
- Make the behavior verifiable in mock-backend debug mode with realistic SDK-shaped responses.
- Document the bug and fix in `BUGS.md`.

## Test Plan

- BDD.
- RED: add tests proving `canFinalizeX` results for a different action index do not advance the active operation, and a locally completed operation is classified as unverified until recovery returns terminal state.
- GREEN: implement action-index tracking, index-gated finalization checks, unverified completed status, and mock-backend debug verification path. Run focused bridge-ui tests, lint, typecheck, and the full bridge-ui suite.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts` failed before implementation with the new index-discriminant tests:
  - `ignores a deposit finalization capability for another action index` transitioned out of `PENDING_DEPOSIT` when `canFinalizeDeposit` returned `index: 1` for an operation with `actionIndex: 2`.
  - `ignores an already-finalised withdrawal result for another action index` sent parent `CompleteOperation` when `canFinalizeWithdrawal` returned `status: "alreadyFinalised", index: 1` for an operation with `actionIndex: 2`.
- `moon run bridge-ui:test -- test/unit/bridge-operations-table.test.ts` failed before implementation because `BridgeOperations.vue` hardcoded label text by status kind and did not render `row.original.statusText`, so a yellow `Unindexed` completed row could not be displayed.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts test/unit/recovery.test.ts test/unit/mock-backend-worker.test.ts test/unit/bridge-operations-table.test.ts test/unit/bridge-view-model.test.ts test/unit/bridge-refresh-queue.test.ts` passed with 52 tests across 6 files.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test` passed with 144 tests across 27 files.
- `moon run bridge-ui:lint` passed after the final formatting cleanup.
