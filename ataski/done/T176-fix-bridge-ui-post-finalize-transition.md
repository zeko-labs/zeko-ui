---
id: T176
title: "Fix bridge UI post-finalize transition"
status: done
blockedBy: []
owner: Codex
created_at: 2026-05-06T23:45:16Z
updated_at: 2026-05-06T23:54:48Z
---

## Requirements

- After a bridge operation finishes finalization and emits `CompleteOperation`, the Bridge UI must stop showing that operation as the active/current operation.
- If no queued operation exists, the main bridge widget must return to the initial input form so the user can start another bridge operation.
- If queued operations exist, the next queued operation must be resumed and become the active/current operation.
- Completed operations must remain available in the completed transactions list.
- Keep changes scoped to the bridge UI machine/state derivation and tests; do not alter unrelated endpoint or wallet configuration changes.

## Test Plan

- BDD: add bridge UI machine/component coverage that models user-visible behavior after completion.
- RED path: assert that completing the current operation removes it from the active card when there is no queue, and assert that completing the current operation resumes the queued operation when one exists.

## RED Evidence

- `moon run bridge-ui:test -f -- test/unit/bridge-view-model.test.ts` failed before implementation because `../../app/components/bridgeOperationView` did not exist. The new BDD spec defines the expected UI transition model: no active operation returns the main widget to inputs; an active queued operation becomes the current operation while completed operations stay in the completed list.
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts` failed on `notifies the parent immediately when SDK deposit finalization completes`: after the actor reached `BRIDGE_OPERATION_COMPLETED`, the parent bridge actor had not received `CompleteOperation` yet.

## GREEN Evidence

- `moon run bridge-ui:test -f -- test/unit/bridge-view-model.test.ts` passed (2 tests).
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts` passed (5 tests).
- `moon run bridge-ui:test -f` passed (13 files, 60 tests).
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
