---
id: T152
title: "Fix bridge-sdk live deposit cancellability and withdrawal status"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-03-25T10:29:31Z
updated_at: 2026-03-25T16:15:00Z
---

## Requirements

- Investigate the current live SDK and bridge-cli status outputs for the validation wallet and fix the state reporting defects the user called out.
- Deposits that are genuinely cancellable on-chain must be reported as cancellable by the SDK/CLI instead of remaining `cancellable: false`.
- Withdrawal status output must not report bogus submission dates for unresolved withdrawals; if the data source has no trustworthy timestamp, the SDK/CLI should not fabricate one.
- Keep the fix additive and consistent with the existing bridge-sdk and bridge-cli surfaces.

## Test Plan

- TDD
- Add or extend bridge-sdk and bridge-cli tests around deposit cancellability and unresolved withdrawal timestamp/status formatting before changing the live-reporting logic.

## RED Evidence

- Live bridge-sdk state for `B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq` showed unresolved withdrawals with `timestamp: "0"`, which propagated bogus submission dates into the CLI/UI.
- The same wallet still shows no cancellable deposits because the recorded on-chain timeout values for the unresolved deposits are still in the future relative to the SDK current slot, so the remaining live mismatch is on the submit/timeout side rather than the status display path.
- The bridge-ui timeout label and the SDK cancellation predicate were off by one slot: the UI treated `currentSlot >= timeout` as timed out, while the SDK required `currentSlot > timeout`.
- The SDK also treated a timed-out accepted deposit as non-cancellable whenever a finalization witness existed, which kept the active deposit claimable after timeout.

## GREEN Evidence

- Added bridge-sdk coverage in `packages/bridge-sdk/test/deposit-cancellation.test.ts` for timed-out accepted deposits and in `packages/bridge-sdk/test/withdrawal-state.test.ts` for unresolved withdrawal timestamp normalization.
- Added bridge-cli coverage in `packages/bridge-cli/tests/adapter.test.ts` for status timestamp normalization and normalized `"0"` timestamps in `packages/bridge-cli/src/core/adapter.ts`.
- Fixed the bridge-sdk test harness to use a local `vitest.config.ts` with the workspace GraphQL alias and to exclude `test/live.manual.test.ts` from the automated `moon run bridge-sdk:test` task.
- Added bridge-sdk boundary coverage for exact-timeout cancellability and for timed-out accepted deposits preferring cancellation over finalization in `packages/bridge-sdk/test/deposit-cancellation.test.ts`.
- `moon run bridge-sdk:test`
- `moon run bridge-sdk:typecheck`
- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`
