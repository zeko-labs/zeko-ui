---
id: T376
title: "Promote inner actions by archive canonical status"
status: done
blockedBy: [T375]
owner: codex
created_at: 2026-06-17T11:16:46Z
updated_at: 2026-06-17T11:31:00Z
---

## Requirements

- Fix the actions indexer L2 finality rule so fetched inner actions are marked canonical when their archive block is `chainStatus: canonical`.
- Pending L2 archive blocks must remain non-final in the actions DB.
- The implementation must stop relying on a 72-hour timestamp threshold for inner action canonical promotion.
- The change must preserve orphaned-chain filtering before action processing.

## Test Plan

- TDD.
- RED: add an actions-indexer unit test proving canonical L2 archive block status is treated as final and pending status is not.
- GREEN: update the inner indexer finality rule to use archive `chainStatus` and run the targeted actions-indexer tests.

## RED Evidence

- `pnpm --filter @zeko/actions-indexer exec vitest run test/inner-finality.test.ts` failed as expected: `isCanonicalInnerActionBlock is not a function`.

## GREEN Evidence

- `pnpm --filter @zeko/actions-indexer exec vitest run test/inner-finality.test.ts` passed: 1 test passed.
- `NODE_OPTIONS=--preserve-symlinks pnpm --filter @zeko/actions-indexer exec vitest run test/inner-finality.test.ts test/action-canonical-filter.test.ts test/action-processing.core.test.ts` passed: 7 tests passed. The symlink option is needed because this feature worktree is nested under the parent checkout.
- `moon run actions-indexer:typecheck -f` passed.
- `moon run actions-indexer:lint -f` passed.
- `moon run actions-indexer:build -f` passed.
