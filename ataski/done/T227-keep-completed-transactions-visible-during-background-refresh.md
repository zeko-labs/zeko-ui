---
id: T227
title: "Keep completed transactions visible during background refresh"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-26T00:00:00Z
updated_at: 2026-03-26T07:39:00Z
---

## Requirements

- The completed transactions table must not switch back to loading placeholders during periodic background refresh.
- The loading placeholder is only valid for the initial empty load, before any completed rows are available.
- Keep the fix local to bridge-ui and preserve the existing bridge refresh flow.

## Test Plan

- TDD
- Add unit coverage for the loading decision before changing the completed-transactions component so background refresh no longer hides existing rows.

## RED Evidence

- `BridgeOperations.vue` derives loading from the parent bridge machine being outside `READY`, so every `REFRESH_OPERATIONS` transition replaces completed rows with placeholders.

## GREEN Evidence

- Updated `apps/bridge-ui/app/components/BridgeOperations.vue` so completed-transaction loading placeholders are shown only for the initial empty load, not during periodic background refresh.
- Added `shouldShowCompletedOperationsLoading(...)` in `apps/bridge-ui/app/helpers.ts` and unit coverage in `apps/bridge-ui/test/unit/helpers-progress.test.ts`.
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
