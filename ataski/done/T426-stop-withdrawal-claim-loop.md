---
id: T426
title: "Stop withdrawal claim loop"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T06:17:17Z
updated_at: 2026-06-25T07:01:19Z
---

## Requirements

- Linear: WEB-502.
- Add a bridge UI debug-mode scenario that reproduces an old-wallet withdrawal claim failure by making the mock backend fail the claim/finalize backend call.
- The scenario must fail through `finalizeWithdrawal` or SDK signature completion, not through a frontend-only shortcut.
- A withdrawal claim failure must show clear feedback instead of returning to `TO_FINALIZE` with the Claim button enabled and no visible error.
- The operation must preserve the original claim failure in `context.errors` and terminate or fail the operation consistently so the user does not get stuck clicking Claim repeatedly.

## Test Plan

- BDD.
- RED: add a failing debug backend test for the new claim-failure scenario and a failing bridge operation test that currently shows the loop by returning to `TO_FINALIZE` after a claim error.
- GREEN: update bridge operation error handling so the claim failure becomes visible and the debug scenario reproduces the backend failure faithfully.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-sentry.test.ts test/unit/sentry-client-config.test.ts test/unit/bridge-operations-table.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-current-operation.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` failed: the withdrawal claim-failure debug scenario was missing, mock `completeSdkSignature` resolved instead of rejecting, and the bridge operation test timed out waiting for `FAILED` after a withdrawal claim backend error.

## GREEN Evidence

- `moon run bridge-ui:test` passed: 29 test files, 163 tests.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:build -f` passed.
