---
id: T095
title: "Relocate bridge error telemetry helper"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T16:36:41Z
updated_at: 2026-03-12T16:45:33Z
---

## Requirements

- Move the bridge Sentry/error telemetry helper out of `apps/bridge-ui/machines/`.
- Rename it so the file name reflects what it actually does rather than implying it is an XState machine.
- Update imports and tests accordingly.

## Test Plan

- TDD.
- RED first: confirm the current helper location/name is misleading and update the focused tests/imports to target the new module path.
- GREEN second: run the affected bridge Sentry tests and the bridge UI test/typecheck flow after the relocation.

## RED Evidence

- The helper lived in `apps/bridge-ui/machines/bridge-sentry.ts`, which implied it was an XState machine even though it is just telemetry/error-capture logic.
- The first relocation pass immediately exposed a bad relative import (`../app/errors`), confirming the move needed focused validation instead of a blind rename.

## GREEN Evidence

- Moved the helper to `apps/bridge-ui/app/telemetry/bridgeErrors.ts` and updated the imports/tests to match the new app-level telemetry location.
- `pnpm --dir apps/bridge-ui exec vitest run test/unit/bridge-sentry.test.ts` passes after the move.
- `pnpm --dir apps/bridge-ui exec nuxt typecheck` exits successfully after the relocation.
