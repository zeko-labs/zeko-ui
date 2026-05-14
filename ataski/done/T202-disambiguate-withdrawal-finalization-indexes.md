---
id: T202
title: "Disambiguate withdrawal finalization indexes"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-12T21:13:40Z
updated_at: 2026-05-12T21:31:30Z
---

## Requirements

- Extend SDK `canFinalizeDeposit` and `canFinalizeWithdrawal` results with the selected operation `index` when the SDK can identify a concrete finalization target or already-finalised withdrawal.
- For withdrawals, return the index for both available finalization and `alreadyFinalised` status so callers can distinguish an older already-finalised withdrawal from the current target.
- The CLI must only treat `canFinalizeWithdrawal().status === "alreadyFinalised"` as terminal when the returned index matches the target or queued claim it is evaluating.
- The CLI must not call `canFinalizeWithdrawal` for an uncommitted current target unless it is advancing an already-committed queued withdrawal ahead of it.
- Preserve normal waiting behavior for non-terminal unavailable withdrawal finalization states.
- Apply the same reconciliation to live bridge runs and `operation status` refresh.

## Test Plan

- TDD: add focused SDK tests that assert `canFinalizeDeposit` and `canFinalizeWithdrawal` include the selected index for available/already-finalised results.
- Add CLI flow tests where an already-finalised result for the current target completes, an already-finalised result for an older index does not complete the current target, and an uncommitted target does not trigger finalizability checks.
- RED expectation: tests fail before implementation because SDK capability results do not expose an index and the CLI cannot disambiguate the result.
- GREEN expectation: SDK and CLI tests pass, plus bridge CLI/SDK typechecks pass.

## RED Evidence

- `moon run bridge-cli:test -f -- tests/bridge-flow.test.ts -t "already finalised"` failed before implementation: the new test received operation status `failed` instead of `completed` because the CLI waited after the SDK reported `status: "alreadyFinalised"`.
- Live check showed why index is required: target withdrawal `10531` was `committed: false`, while `canFinalizeWithdrawal` was referring to already-finalised index `10530`.

## GREEN Evidence

- `moon run bridge-sdk:test -f -- test/deposit-cancellation.test.ts test/withdrawal-finalization-state.test.ts` passes.
- `moon run bridge-cli:test -f -- tests/bridge-flow.test.ts -t "withdrawal"` passes.
- `moon run bridge-cli:test -f` passes: 72 passed, 13 skipped.
- `moon run bridge-cli:typecheck -f` passes.
- `moon run bridge-sdk:test -f` passes: 33 passed.
- `moon run bridge-sdk:typecheck -f` passes.
- `moon run bridge-cli:build -f` passes.
- Live follow-up: rebuilt CLI no longer has the index ambiguity, but the existing withdrawal operation status refresh is currently blocked before finalization logic because `getWithdrawalStatuses` exceeded a 45s bounded probe.
