---
id: T371
title: "Gate already-finalised withdrawals by commit range"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:18:00Z
updated_at: 2026-06-17T07:22:00Z
---

## Requirements

- Resolve the Codex review P2 finding in `packages/bridge-sdk/src/withdrawals.ts`.
- When repeated same-recipient/same-amount withdrawals have distinct transaction hashes, do not return `alreadyFinalised` while any matching witness for the wallet is not yet included in the latest outer commit's inner action range.
- Preserve the valid already-finalised result when every matching witness is already consumed by the helper account or no pending matching withdrawal remains.
- Keep the change scoped to bridge SDK withdrawal finalization state logic and its regression tests.

## Test Plan

- TDD.
- RED: add a bridge SDK test where an older matching withdrawal is consumed, a newer matching withdrawal has a final inner witness, and `fetchInnerActionsFromIndexer` returns only the older committed range. `canFinalizeWithdrawal` must report `waiting`, not `alreadyFinalised`.
- GREEN: update the already-finalised guard to consider matching witnesses outside the committed range, then rerun the focused bridge SDK tests.

## RED Evidence

- `pnpm --dir packages/bridge-sdk exec vitest run test/withdrawal-finalization-state.test.ts --testNamePattern "newer same-aux witness is outside the committed range"` failed as expected. The new regression received `status: "alreadyFinalised"` and `index: 0` instead of the expected waiting result while the newer matching witness was outside the committed range.

## GREEN Evidence

- `pnpm --dir packages/bridge-sdk exec vitest run test/withdrawal-finalization-state.test.ts --testNamePattern "newer same-aux witness is outside the committed range"` passed.
- `moon run bridge-sdk:test bridge-sdk:typecheck graphql:typecheck actions-api:typecheck -f` passed, including 60 bridge SDK tests.
- `git diff --check` passed.
