---
id: T434
title: "Fix claim failure scenarios for both routes"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T09:23:44Z
updated_at: 2026-06-25T09:39:02Z
---

## Requirements

- Replace the withdrawal-only claim failure scenario with a route-neutral claim failure scenario that covers both send directions.
- Deposit claim/finalize failures and withdrawal claim/finalize failures must both become visible failed operations instead of returning to claim or getting stuck in confirming.
- The debug scenario must fail through backend/SDK completion, not through a frontend-only shortcut.
- Preserve the original backend failure in `context.errors`.
- Verify both directions in browser with mock backend mode enabled.

## Test Plan

- BDD.
- RED: add failing tests for deposit and withdrawal claim failures under the debug scenario and prove neither remains in a confirming/loading state.
- GREEN: update the scenario and operation error handling so both routes fail visibly.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-refresh-queue.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts test/unit/bridge-ui-copy.test.ts` failed: the scenario list still exposed a withdrawal-only claim-failure scenario, deposit claim completion resolved instead of rejecting, and finalization failure tests expected visible failed operations without `TerminateOperation`.

## GREEN Evidence

- `moon run bridge-ui:format-fix && moon run bridge-ui:test && moon run bridge-ui:typecheck` passed. The full bridge-ui test run covered 29 files and 166 tests.
- `test/unit/mock-backend-worker.test.ts` verifies the route-neutral `repro-claim-failure` scenario rejects both deposit and withdrawal claim completion through the mock backend.
- `test/unit/bridge-operation.test.ts` verifies deposit and withdrawal claim/finalize failures both transition to visible failed operations, preserve the backend error, and do not return to the claim loop via parent termination.
- Browser mock-backend execution was blocked by the in-app browser storage policy; no workaround was used.
