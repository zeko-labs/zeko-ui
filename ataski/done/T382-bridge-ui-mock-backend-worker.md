---
id: T382
title: "Bridge UI mock backend worker"
status: done
blockedBy: [T380]
owner: codex
created_at: 2026-06-18T22:00:49Z
updated_at: 2026-06-18T22:11:40Z
---

## Requirements

- Implement a debug backend worker that satisfies the exact `OperationsWorker` interface exported by `apps/bridge-ui/machines/operations.worker.ts`.
- Preserve real Auro signing by returning realistic JSON zkApp signature requests from worker methods and accepting the real signed command in `completeSdkSignature`.
- Return deterministic fake transaction hashes from `completeSdkSignature` instead of sending signed transactions to live backend/chain services.
- Simulate backend quirks through a typed scenario state persisted in localStorage:
  - happy path
  - delayed deposit finalization
  - delayed withdrawal finalization
  - already finalized withdrawal
  - recovered pending deposit/withdrawal on load
  - cancellable deposit
  - cancelled deposit
  - fee-too-low retry
  - transient worker error
  - terminal worker error
- Keep balances and wallet network/account behavior live through Auro; do not intercept balance fetches by default.
- Expose enough debug state for a later panel to inspect scenario, mock worker call log, signature requests, signed completion receipts, fake hashes, current slot, and seeded pending operations.

## Test Plan

- TDD: add unit tests that fail until the mock backend worker implements `OperationsWorker` exactly and supports real signed command completion.
- TDD: add scenario tests that fail until selected backend quirks can be configured and observed through the mock worker state.
- GREEN target: focused mock-worker tests, `moon run bridge-ui:test -f`, and `moon run bridge-ui:typecheck -f`.

## RED Evidence

- `moon run bridge-ui:test -f -- test/unit/mock-backend-worker.test.ts` failed as expected because `../../machines/mockBackend` does not exist yet.

## GREEN Evidence

- `moon run bridge-ui:test -f -- test/unit/mock-backend-worker.test.ts` passed: 1 file, 5 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:test -f` passed: 24 files, 123 tests.
