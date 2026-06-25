---
id: T427
title: "Restore bridge Sentry telemetry"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T06:17:17Z
updated_at: 2026-06-25T07:01:19Z
---

## Requirements

- Linear: WEB-503.
- Ensure handled bridge errors that the UI surfaces are also captured by Sentry with bridge context.
- Ensure Sentry replay sampling is useful for production diagnosis instead of relying only on error-triggered replay capture.
- Keep wallet rejection and third-party-only noise filters intact.
- Add a debug-mode scenario or instrumentation coverage that proves a handled bridge failure is not silently dropped by the app-originated Sentry filtering path.

## Test Plan

- TDD.
- RED: add failing tests for Sentry config/options proving replay baseline sampling is non-zero and handled bridge errors are tagged as app-originated so the third-party filter does not drop them.
- GREEN: move any necessary Sentry config into testable helpers and update capture code/config while preserving existing ignore behavior.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-sentry.test.ts test/unit/sentry-client-config.test.ts test/unit/bridge-operations-table.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-current-operation.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` failed: `app/telemetry/sentryOptions` did not exist for replay sampling assertions, and handled bridge errors were captured without the `app_originated` Sentry tag.

## GREEN Evidence

- `moon run bridge-ui:test` passed: 29 test files, 163 tests.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:build -f` passed.
