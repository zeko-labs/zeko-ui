---
id: T105
title: "Fix withdrawal fee-threshold early failure"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T19:12:00Z
updated_at: 2026-03-19T19:20:00Z
---

## Requirements

- Catch the first-withdrawal helper-account fee-threshold failure during withdrawal submission instead of only surfacing it later during finalization.
- In `bridge-sdk`, check the withdrawal amount against the threshold first, and only query helper-account existence when the amount is below the threshold.
- Preserve the rule that existing helper accounts are not blocked by this threshold.
- Keep the finalize-time guard consistent so the same SDK error remains the shared source of truth if a submission bypasses the early path.
- Update CLI and UI handling/tests so this condition is treated as an early SDK failure with clear user-facing messaging rather than a later finalize-time stall/failure.

## Test Plan

- RED path:
  - inspect current SDK submit flow and confirm helper-account lookup happens for every withdrawal
  - inspect current CLI/UI tests and confirm they still model this condition as a later finalize/polling failure
- GREEN path:
  - add/update SDK tests for threshold-first helper lookup behavior
  - add/update CLI bridge-flow coverage for submit-time terminal failure
  - add/update UI tests for submit-time handling and friendly messaging
  - rerun focused package tests, then broader package verification

## RED Evidence

- `Bridge.submitWithdrawal(...)` currently fetches the L1 helper account unconditionally before checking whether the amount is even below the L1 account-creation fee threshold.
- CLI regression coverage still models this protocol error as a later `canFinalizeWithdrawal()` failure instead of an early submission failure.
- UI coverage currently only verifies message mapping, not the submit-time machine behavior for this SDK error.

## GREEN Evidence

- `Bridge.submitWithdrawal(...)` now checks the threshold first and only queries helper-account existence when the withdrawal amount is below the L1 account-creation fee.
- The shared SDK protocol error now says the withdrawal cannot proceed as submitted, so the same message is accurate at submit time and at finalize time.
- CLI bridge-flow coverage now asserts this condition fails during `submitWithdrawal` without falling through into later inspection/finalization logic.
- UI machine coverage now asserts `SUBMIT_WITHDRAWAL` preserves the SDK error in context and continues to map it to the existing user-friendly helper-account explanation.
- Added `~` / `~~` alias resolution to `apps/bridge-ui` Vitest config so machine-level UI tests can import the real Nuxt/XState modules under test.
- `pnpm --dir packages/bridge-sdk exec vitest run test/errors.test.ts`
- `pnpm --dir packages/bridge-cli exec vitest run tests/bridge-flow.test.ts --config vitest.config.ts`
- `pnpm --dir apps/bridge-ui exec vitest run test/unit/bridge-operation.test.ts test/unit/wallet-errors.test.ts`
- `moon run bridge-sdk:test bridge-cli:test bridge-ui:test`
- `moon run bridge-sdk:typecheck bridge-cli:typecheck bridge-ui:typecheck`
