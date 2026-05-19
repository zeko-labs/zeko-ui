---
id: T220
title: "Split bridge-ui queue by direction and match CLI state"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-25T10:29:31Z
updated_at: 2026-03-25T10:51:09Z
---

## Requirements

- Bridge-ui must not present a mixed deposit-and-withdrawal queue when the user is viewing a single bridge direction.
- Align the visible queue with the selected route so the UI state can be compared directly to the corresponding `bridge-cli` route status.
- Preserve the separate cancellable-deposit lane, but only for the currently relevant direction and only when the SDK marks deposits as cancellable.
- Keep the additional queue metadata visible under `Next Transactions`.

## Test Plan

- TDD
- Add or extend recovery and UI selection tests to prove deposits and withdrawals are no longer mixed in the same visible queue for a single route.

## RED Evidence

- The bridge UI recovered and displayed deposits and withdrawals in one mixed queue even when the user was viewing a single route, so the UI state could not be reconciled directly against `bridge-cli deposit status` or `bridge-cli withdrawal status`.
- Unknown withdrawal timestamps were being turned into fake submission dates in the UI because `"0"` was parsed into a real `Date`.

## GREEN Evidence

- Filtered recovery input by the selected route direction before bucketing in `apps/bridge-ui/machines/bridge.ts` and `apps/bridge-ui/machines/recovery.ts`, so deposit and withdrawal queues are no longer mixed for a single route.
- Normalized missing transaction dates in `apps/bridge-ui/machines/operations.worker.ts`, `apps/bridge-ui/app/helpers.ts`, and `apps/bridge-ui/app/components/BridgeOperations.vue`, so unknown withdrawal timestamps render as unknown instead of bogus dates.
- Added route-filter coverage in `apps/bridge-ui/test/unit/recovery.test.ts` and missing-date coverage in `apps/bridge-ui/test/unit/helpers-queue.test.ts`.
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
