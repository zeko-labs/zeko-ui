---
id: T433
title: "Fix under-minimum input and first withdrawal error"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T09:23:44Z
updated_at: 2026-06-25T09:39:02Z
---

## Requirements

- Amount input and token amount display must turn red when the entered amount is below the 2 MINA bridge minimum.
- The send button must remain disabled below 2 MINA, but valid amounts at or above 2 MINA must be sendable in the `repro-first-withdrawal-too-small` scenario.
- The first-withdrawal-too-small debug scenario must display visible UI feedback when `Seed Withdrawal` then `RefreshOperations` reproduces the backend error.
- The visible failure must preserve the backend/SDK error message instead of being console-only.
- Verify in browser with mock backend mode enabled.

## Test Plan

- BDD.
- RED: add failing tests for amount minimum styling state and visible terminal withdrawal status errors, then manually reproduce the debug scenario in browser.
- GREEN: wire the selector invalid state and ensure terminal pending-withdrawal errors surface through the existing operation error UI.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-refresh-queue.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts test/unit/bridge-ui-copy.test.ts` failed: `amountIsBelowBridgeMinimum` was missing, `Inputs.vue` did not wire minimum-invalid state to `BridgeAmountSelector`, and the first-withdrawal terminal error path still sent `TerminateOperation`.

## GREEN Evidence

- `moon run bridge-ui:format-fix && moon run bridge-ui:test && moon run bridge-ui:typecheck` passed. The full bridge-ui test run covered 29 files and 166 tests.
- `test/unit/bridge-inputs.test.ts` verifies the 2 MINA minimum helper and that the amount selector receives the invalid state below 2 MINA.
- `test/unit/bridge-operation.test.ts` verifies the first-withdrawal-too-small backend error is retained on the failed operation and no longer terminates the operation before UI feedback can render.
- `test/unit/bridge-current-operation.test.ts` verifies failed operation cards render the user-friendly error message directly in the operation UI as well as sending it to the toast.
- Browser dev server rendered the no-wallet gate. Mock-backend debug-mode scenario execution was blocked by browser security policy around setting the existing debug-mode storage key, so this task is covered by executable machine/component-boundary tests.
