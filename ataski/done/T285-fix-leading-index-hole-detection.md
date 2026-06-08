---
id: T285
title: "Fix leading index hole detection"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-08T17:46:00Z
updated_at: 2026-06-08T17:48:00Z
---

## Requirements

- Address the Codex review finding that action-index integrity treats `[1, 2, 3]` as dense.
- Enforce zero-based action index density so the first missing index is `0` when the table starts above zero.
- Add a focused regression test.

## Test Plan

- TDD: Add a leading-hole regression test, then update integrity analysis so the repair index becomes `0`.

## RED Evidence

- Codex review reported that scanning from `minIndex` misses leading holes even though indexer-generated action indexes start at `0`.

## GREEN Evidence

- Integrity expected count is now based on the zero-based range `0..maxIndex`, not `minIndex..maxIndex`.
- First missing index scanning starts at `0`, so leading gaps repair from genesis.
- Added a leading-hole regression test.
- Validation passed:
  - `pnpm --filter @zeko/actions-indexer exec vitest run test/action-index-integrity.test.ts test/action-repair.test.ts`
  - `moon run actions-indexer:lint -f`
  - `moon run actions-indexer:typecheck -f`
  - `moon run actions-indexer:build -f`
