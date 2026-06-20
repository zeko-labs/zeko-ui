---
id: T385
title: "debug reproductions for bridge state bugs"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T04:39:04Z
updated_at: 2026-06-19T04:43:55Z
---

## Requirements

- Add bridge-ui mock-backend debug scenarios that reproduce the reported failure class without changing bridge/operation state-machine behavior.
- The reproductions must be realistic: they may only use responses that the SDK/operations worker can actually return, especially `findPendingOperations` action states and `canFinalizeWithdrawal` statuses.
- Cover the report where the UI moves an operation to completed after source-chain confirmation while the destination-chain claim/finalization is not complete by returning a recovered operation with `finalised: true` from `findPendingOperations`.
- Cover the report where withdrawals appear to skip the claim part by returning `canFinalizeWithdrawal` status `alreadyFinalised` after wallet confirmation.
- Cover the low-information withdrawal loop class by returning a persistent SDK non-terminal status, using a real `canFinalizeWithdrawal` status such as `blocked` or `waiting`.
- Expose the scenarios in the debug panel scenario selector through the existing scenario list; do not add UI-only hacks or direct actor state manipulation.

## Test Plan

- BDD: add failing unit assertions for the new mock backend scenarios before implementing them.
- RED should show the scenario names are not accepted/exposed yet and the mock worker does not produce the required SDK-shaped responses.
- GREEN should verify the mock worker returns realistic SDK responses for each reproduction and the debug panel exposes the new scenarios.

## RED Evidence

- `moon run bridge-ui:test -f -- test/unit/mock-backend-worker.test.ts` failed as expected:
  the new reproduction scenario names were not present, `findPendingOperations`
  returned no recovered completed withdrawal, and `canFinalizeWithdrawal`
  returned the default `{ available: true, status: "available" }` instead of
  `alreadyFinalised` or persistent `blocked` SDK-shaped responses.

## GREEN Evidence

- `moon run bridge-ui:test -f -- test/unit/mock-backend-worker.test.ts` passed:
  9 tests, including the new realistic reproduction scenarios.
- `moon run bridge-ui:test -f -- test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts`
  passed: 12 tests.
- `moon run bridge-ui:test -f` passed: 25 files, 130 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
- `git diff --check` passed.
