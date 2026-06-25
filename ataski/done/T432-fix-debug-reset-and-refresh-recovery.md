---
id: T432
title: "Fix debug reset and refresh recovery"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T09:23:44Z
updated_at: 2026-06-25T09:39:02Z
---

## Requirements

- Add a visible Debug Backend reset button so manual verification never requires console-based storage clearing.
- Reset must clear mock backend state and refresh the panel snapshot without requiring console access.
- `Sim Refresh` must not crash with duplicate actor/system IDs such as `Actor with system ID 'debug-withdrawal-1' already exists`.
- Fix the bridge/debug refresh path rather than hiding the crash in debug panel UI.
- Verify in browser with mock backend mode enabled.

## Test Plan

- BDD.
- RED: add failing unit coverage that proves the debug panel exposes reset and that repeated simulated refresh with recovered debug operations does not spawn duplicate actor IDs.
- GREEN: implement reset UI and make simulated refresh dispose or replace existing operation actors correctly.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-refresh-queue.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts test/unit/bridge-ui-copy.test.ts` failed: `BridgeDebugPanel.vue` did not contain a Reset control, and the new repeated `SimulatePageRefresh` coverage reproduced the XState duplicate actor/system ID crash.

## GREEN Evidence

- `moon run bridge-ui:format-fix && moon run bridge-ui:test && moon run bridge-ui:typecheck` passed. The full bridge-ui test run covered 29 files and 166 tests.
- `test/unit/debug-panel.test.ts` verifies the Reset control and reset controller behavior.
- `test/unit/bridge-refresh-queue.test.ts` verifies repeated `SimulatePageRefresh` with recovered debug operations no longer throws duplicate actor/system ID errors.
- Browser dev server started at the local bridge app and rendered the no-wallet gate. The in-app browser could not enable mock-backend debug mode because its security policy blocked setting the existing `bridgeDebugMode` storage key; that blocker is recorded instead of claiming full browser debug-scenario execution.
