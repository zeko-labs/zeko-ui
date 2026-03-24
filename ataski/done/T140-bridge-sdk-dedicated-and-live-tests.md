---
id: T140
title: "Bridge SDK dedicated and live tests"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T14:37:18Z
updated_at: 2026-03-19T14:42:08Z
---

## Requirements

- Keep the existing bridge diagnostics tests, but move the new deposit-cancellability behavior coverage out of `packages/bridge-sdk/test/diagnostics.test.ts` into a dedicated test file.
- Update `packages/bridge-sdk/moon.yml` so the standard `bridge-sdk:test` task runs the bridge-sdk test files explicitly instead of only `diagnostics.test.ts`.
- Add a separate live read-only bridge-sdk test that verifies existing public SDK read paths against real network endpoints without requiring signing or mutation.
- The live test must cover existing behavior that could regress from the cancellation refactor, including `fetchDepositsWithStates(pk)` and `canCancelDeposit(pk)` for the same public key.
- Keep live validation isolated from the normal unit test task so routine local and CI runs are not made flaky by network access.

## Test Plan

- DDD
- Split the current mocked deposit-cancellation state coverage into its own Vitest file and keep diagnostics coverage in `diagnostics.test.ts`.
- Add a dedicated live Vitest file plus a separate Moon task that runs only that file.
- Re-run `moon run bridge-sdk:build`, `moon run bridge-sdk:typecheck`, `moon run bridge-sdk:test`, and the new live task.

## RED Evidence

- The first `moon run bridge-sdk:manual-live-test` run failed because the real network path took longer than Vitest's default 5s timeout. Increased only the live test timeout to 30s and re-ran without weakening the assertions.

## GREEN Evidence

- Moved the mocked deposit-cancellation behavior coverage into `packages/bridge-sdk/test/deposit-cancellation.test.ts`.
- Restored `packages/bridge-sdk/test/diagnostics.test.ts` to diagnostics-only coverage.
- Updated `packages/bridge-sdk/moon.yml` so `bridge-sdk:test` runs the explicit bridge-sdk unit test files instead of only `diagnostics.test.ts`.
- Added `bridge-sdk:manual-live-test` for a separate read-only live validation path against public bridge endpoints.
- Added `packages/bridge-sdk/test/live.test.ts` to verify that `fetchDepositsWithStates(pk)` and `canCancelDeposit(pk)` stay aligned on a real network and that cancelled/finalised deposits are not reported as cancellable.
- Validation:
  - `moon run bridge-sdk:build`
  - `moon run bridge-sdk:typecheck`
  - `moon run bridge-sdk:test`
  - `moon run bridge-sdk:manual-live-test`
