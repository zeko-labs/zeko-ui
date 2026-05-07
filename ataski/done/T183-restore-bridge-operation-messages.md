---
id: T183
title: "Restore bridge operation transaction messages"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-07T09:53:24Z
updated_at: 2026-05-07T09:58:00Z
---

## Requirements

- Restore the Bridge UI operation messages that were removed when the transaction flow moved from `send_and_confirm` to the unified `transactionMachine`.
- Update the state checks so the UI distinguishes transaction generation/signing from transaction completion/confirmation under the new machine shape.
- Preserve the existing message keys and transaction hash rendering for submit, finalize, and cancel confirmation phases.
- Keep unrelated local endpoint changes in `apps/bridge-ui/machines/helpers.ts` untouched.

## Test Plan

- TDD: add a failing unit test proving `bridgeOperationMachine` records child transaction stage updates for the current operation. Then use that stage in the component conditions so the restored message branches are driven by the new state machine instead of obsolete `send_and_confirm` state names.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts -t "tracks the active child transaction stage"` fails because `transactionStage` remains `undefined` after the child transaction actor emits `{ type: "TransactionStage", key: "finalizeDeposit", stage: "complete" }`.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/bridge-operation.test.ts -t "tracks the active child transaction stage"` passes.
- `moon run bridge-ui:test -- test/unit/transaction-machine.test.ts test/unit/bridge-operation.test.ts` passes with 9 tests.
- `moon run bridge-ui:typecheck` passes.
- `moon run bridge-ui:lint` passes.
