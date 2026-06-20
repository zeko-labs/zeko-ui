---
id: T386
title: "debug panel recovery controls"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T04:59:49Z
updated_at: 2026-06-19T05:07:25Z
---

## Requirements

- Make the debug panel's add deposit/add withdrawal controls actually populate the visible bridge queue by going through the normal `findPendingOperations` recovery path.
- Add a debug control that simulates a page refresh/recovery sync without wiping mock backend state.
- Add a debug control that clears completed operation actors from the visible operation list.
- When a mocked SDK submission succeeds, persist a realistic recovered operation in the mock backend so a page reload or simulated refresh can find the successful operation through `findPendingOperations`.
- Keep all reproduction behavior realistic and SDK-boundary driven: no direct mutation of child operation actor state and no special bridge completion hacks.

## Test Plan

- BDD: add failing tests that prove the debug controller can seed recovered operations, request bridge recovery refreshes, clear completed operation actors, and that successful mock SDK submissions are recoverable through `findPendingOperations`.
- RED should fail because the controller currently has no bridge sync/clear hooks and `completeSdkSignature` does not persist recoverable operation state.
- GREEN will run the focused debug panel/mock backend tests plus bridge-ui validation.

## RED Evidence

- `moon run bridge-ui:test -f -- test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts`
  failed as expected: the panel did not contain `Sync Backend` or `Clear Completed`,
  `createBridgeDebugPanelController` did not expose `simulatePageRefresh`, and
  `completeSdkSignature` did not persist successful mock withdrawal submissions
  for later recovery through `findPendingOperations`.

## GREEN Evidence

- `moon run bridge-ui:test -f -- test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts`
  passed: 2 files, 14 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
- `moon run bridge-ui:test -f` passed: 25 files, 132 tests.
- `git diff --check` passed.
