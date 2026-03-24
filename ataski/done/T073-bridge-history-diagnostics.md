---
id: T073
title: "Add bridge history diagnostics and stronger witness errors"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T15:53:04Z
updated_at: 2026-03-11T17:04:16Z
---

## Requirements

- Add an operator-facing diagnostic entrypoint under `packages/bridge-sdk` plus a Moon task for running it.
- The diagnostic must accept a wallet address and report archive deposits/withdrawals, computed auxes, actions-api witness matches, and unmatched reason categories.
- Improve bridge-sdk history/witness helper errors so GraphQL errors and Valibot issues are present in thrown error messages instead of generic parse failures.
- Keep `fetchDepositsWithStates` and `fetchWithdrawalsWithStates` return types unchanged in this task.

## Test Plan

- BDD
- Add automated coverage for matched deposits, matched withdrawals, filtered deposits, missing witnesses, and upstream query/parsing failures in the new diagnostic path and error helpers.
- If bridge-sdk lacks a suitable harness, add the minimal targeted harness needed for the new behavior rather than relying on manual-only validation.
- Record RED evidence before source edits, then GREEN evidence with targeted automated coverage plus `moon run bridge-sdk:typecheck -f`.

## RED Evidence

## Test Strategy Exception

`bridge-sdk` currently lacks dedicated automated coverage for the new wallet diagnostic entrypoint. This task will add the minimal targeted harness needed to validate the new behavior, and GREEN evidence must include that coverage plus `moon run bridge-sdk:typecheck -f`.

## GREEN Evidence

- `moon run bridge-sdk:test -f`
  - Passed in the task worktree before merge and again on the canonical branch after merges: 1 file, 4 tests.
- `moon run bridge-sdk:typecheck -f`
  - Passed in the task worktree and again on the canonical branch after merges.
- `moon run bridge-sdk:lint -f`
  - Passed in the task worktree before merge. Biome still reported the pre-existing `packages/bridge-sdk/src/types.ts` warnings about `ExtractInput<T>` using `any`.
