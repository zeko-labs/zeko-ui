---
id: T153
title: "Normalize bridge operation timestamps and harden history render"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T15:30:03Z
updated_at: 2026-03-24T15:55:56Z
---

## Requirements

- Replace the bridge UI's pending-operation transaction date shape with a normalized timestamp shape that cannot throw during rendering.
- Update the bridge operation worker so SDK timestamps are normalized exactly once when pending operations are materialized:
  - digit-only strings are parsed as epoch milliseconds
  - ISO/date-like strings are parsed via `Date.parse`
  - invalid, empty, or missing values become `null`
- Change the internal `ActionState.transaction` contract from `{ date: Date; hash: string }` to `{ timestampMs: number | null; hash: string }`.
- Update the history table in `apps/bridge-ui/app/components/BridgeOperations.vue` so it:
  - never calls `toISOString()` on untrusted values
  - sorts completed operations by normalized timestamp
  - places `null` timestamps after valid timestamps
  - renders `Unknown` for invalid or missing timestamps
- Add focused unit coverage for timestamp normalization and the non-throwing history behavior.

## Test Plan

- TDD.
- RED first: add failing coverage that proves numeric-string SDK timestamps such as `"1700000000000"` currently normalize incorrectly and can crash history rendering via invalid dates.
- GREEN second: implement timestamp normalization and UI hardening, then rerun the targeted bridge-ui tests plus full `bridge-ui:test`.

## RED Evidence

- `PATH="/Users/hebilicious/GitHub/zeko-ui/node_modules/.pnpm/node_modules/.bin:$PATH" moon run bridge-ui:prepare -f` was required in the new worktree so browser-mode vitest could generate `.nuxt`.
- `PATH="/Users/hebilicious/GitHub/zeko-ui/node_modules/.pnpm/node_modules/.bin:$PATH" vitest run test/unit/operation-timestamps.test.ts --config vitest.config.ts` currently fails because `../../machines/operationTimestamps` does not exist yet.
- The RED test now pins the missing normalization surface the implementation must provide before history rendering can be hardened.

## GREEN Evidence

- Added `apps/bridge-ui/machines/operationTimestamps.ts` and rewired the worker/history table to use `timestampMs: number | null` instead of `Date`.
- `PATH="/Users/hebilicious/GitHub/zeko-ui/node_modules/.pnpm/node_modules/.bin:$PATH" vitest run test/unit/operation-timestamps.test.ts test/unit/sentry-client-config.test.ts test/unit/app-root-errors.test.ts --config vitest.config.ts` passes with the timestamp normalization coverage green.
- `PATH="/Users/hebilicious/GitHub/zeko-ui/node_modules/.pnpm/node_modules/.bin:$PATH" moon run bridge-ui:test -f` passes in the feature worktree, and the history-render regression path no longer throws.
