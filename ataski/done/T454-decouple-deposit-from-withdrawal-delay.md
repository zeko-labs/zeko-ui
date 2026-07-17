---
id: T454
title: "Decouple deposit commits from withdrawal delay"
status: done
blockedBy: []
owner: codex
created_at: 2026-07-15T23:36:00Z
updated_at: 2026-07-15T23:42:00Z
---

## Requirements

- Deposit finalization and deposit status must use the latest indexed outer commit and action tail, regardless of that commit's withdrawal-delay maturity.
- A synchronized deposit with a later accepting commit must be finalizable even when `commitAsePastSlot(currentSlot - withdrawalDelay)` has no mature commit.
- Withdrawal finalization must retain its existing `withdrawalDelay`-based commit lookup.
- Pending and canonical indexed outer actions must remain visible to bridge finalization logic.
- Add the required release changeset for the publishable bridge SDK.

## Test Plan

- DDD: first add a regression scenario where the deposit witness is followed by a synchronizing commit whose slot upper bound is still in the future while the delayed commit lookup returns null.
- RED must prove the current SDK incorrectly returns `No outer commit available yet`.
- GREEN must prove deposit finalization becomes available from the indexed commit while the existing null-commit withdrawal tests remain unchanged.

## RED Evidence

- `pnpm --dir packages/bridge-sdk exec vitest run test/null-commit-state.test.ts` failed the new synchronized-deposit scenario: expected `available: true`, received `available: false` with `No outer commit available yet`. The five pre-existing null-commit deposit/withdrawal checks passed.

## GREEN Evidence

- Focused DDD regression: `pnpm --dir packages/bridge-sdk exec vitest run test/null-commit-state.test.ts` passed 6/6 tests.
- Full SDK suite: `moon run bridge-sdk:test -f` passed 17 files and 76 tests, including unchanged withdrawal finalization coverage.
- Static/package gates: `moon run bridge-sdk:typecheck bridge-sdk:lint bridge-sdk:build -f` completed successfully; lint retained two pre-existing `noExplicitAny` warnings in `src/types.ts`.
