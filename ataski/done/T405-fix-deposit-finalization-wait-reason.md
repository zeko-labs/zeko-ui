---
id: T405
title: "Fix deposit finalization wait reason"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T06:20:35Z
updated_at: 2026-06-19T06:24:45Z
---

## Requirements

- Confirm the SDK behavior for `canFinalizeDeposit`: it considers eligible v2 deposit witnesses in index order and returns the first buildable finalization witness; when none is buildable, the user-facing reason must describe the missing finalization condition instead of implying an earlier deposit must be resolved.
- Replace the misleading message `Deposit is not finalizable yet; an earlier deposit must be resolved first`.
- The replacement reason must be useful in CLI/operator output when a deposit witness is visible but not yet accepted/confirmed by a synchronized outer action state.
- Keep the change scoped to deposit finalization diagnostics; do not change bridge protocol behavior.

## Test Plan

- TDD.
- RED: add/update a focused Bridge SDK test that asserts a visible-but-not-buildable deposit wait reason does not mention an earlier deposit and instead says finalization is waiting for a synchronized bridge commit/state.
- GREEN: update the SDK diagnostic message and run the focused Bridge SDK test target.

## RED Evidence

- `moon run bridge-sdk:test -f` failed as expected after updating the test expectation.
- Failing test: `packages/bridge-sdk/test/deposit-cancellation.test.ts > deposit cancellation state > reports when a deposit is waiting for a synchronized bridge commit before it can finalize`.
- Failure summary: expected `Deposit 0 is not finalizable yet; no synchronized bridge commit currently confirms this deposit`, received `Deposit is not finalizable yet; an earlier deposit must be resolved first`.

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed: 14 test files, 63 tests.
- `moon run bridge-sdk:typecheck -f` passed.
- Added a patch changeset for `@zeko-labs/bridge-sdk`.
