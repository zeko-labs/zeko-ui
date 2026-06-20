---
id: T397
title: "Clean debug panel controls"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T12:00:53Z
updated_at: 2026-06-19T12:06:27Z
---

## Requirements

- Rename the manual recovery refresh control from `Sync Backend` to `RefreshOperations`, matching the bridge event it sends.
- Re-enable `RefreshOperations`, because it exercises the same bridge refresh path as automatic recovery polling.
- Keep export available as a debug snapshot sharing tool, because it includes worker call inputs/outputs, signature requests, seeded operations, and state beyond the compact panel log.
- Remove the `Clear Logs` button from the panel.
- Remove the remaining disabled controls from the visible panel for now: `Reset`, `Advance`, `Fee Retry`, `Terminal Error`, `Transient Error`, and `Cancellable`.
- Keep useful backend/controller methods if tests or scenario plumbing still use them.

## Test Plan

- BDD.
- RED: update the debug panel source test so it expects `RefreshOperations` and no longer expects the removed disabled controls.
- GREEN: update the Vue panel, keep controller behavior for retained actions, then run the focused debug-panel test, bridge-ui lint, typecheck, and full bridge-ui tests.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/debug-panel.test.ts` failed before implementation.
- Failure: `includes the expected debug controls` expected `RefreshOperations`, but the panel still rendered the old `Sync Backend` control and other disabled controls.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/debug-panel.test.ts` passed: 1 file, 4 tests.
- `moon run bridge-ui:lint` passed: Biome checked 108 files with no errors.
- `moon run bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:test` passed: 27 files, 148 tests.
