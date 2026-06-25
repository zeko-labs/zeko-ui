---
id: T425
title: "Surface console-only bridge errors"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T06:17:17Z
updated_at: 2026-06-25T07:01:19Z
---

## Requirements

- Linear: WEB-501.
- Add a bridge UI debug-mode scenario that reproduces a real backend/SDK error path for the first Zeko-to-Mina withdrawal being too small.
- The debug scenario must make the mock backend return the same class of backend/SDK error that production returns; it must not inject a UI-only state or fake a frontend-only failure.
- When that error reaches the bridge operation flow, the current operation must enter a visible failed state and keep the original error in `context.errors` so the existing toast and error telemetry paths can surface it.
- Update the user-friendly message for the first Zeko-to-Mina withdrawal threshold so it matches the current fee model and 2 MINA bridge minimum.

## Test Plan

- BDD.
- RED: add failing tests that select the new debug scenario and prove the mock backend emits the first-withdrawal-too-small error through the worker path, then add a bridge operation test proving the error is retained and mapped to the updated UI message.
- GREEN: implement the mock backend scenario and bridge error copy so the tests pass without UI-only hacks.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-sentry.test.ts test/unit/sentry-client-config.test.ts test/unit/bridge-operations-table.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-current-operation.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` failed: the new first-withdrawal debug scenario was missing, `canFinalizeWithdrawal` resolved instead of rejecting with the first-withdrawal threshold error, `toUserFriendlyMessage` still returned the old 1 MINA helper-account copy, and `CurrentOperation.vue` still watched `machine.value.context.errors` directly instead of a reactive source.

## GREEN Evidence

- `moon run bridge-ui:test` passed: 29 test files, 163 tests.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:build -f` passed.
