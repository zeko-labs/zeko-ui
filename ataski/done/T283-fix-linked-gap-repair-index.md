---
id: T283
title: "Fix linked gap repair index"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-08T17:29:06Z
updated_at: 2026-06-08T17:33:00Z
---

## Requirements

- Address the Codex review finding that action repair uses a truncated linked-gap diagnostic sample to choose the repair start.
- Compute the linked-state repair index from every linked gap while keeping the visible sample bounded for logs and health/debug output.
- Update tests so a sampled-out linked gap that points to an earlier repair index is covered.

## Test Plan

- TDD: Add a regression test that would fail if repair planning only considered `linkedGapSample`, then update integrity analysis and repair planning until the test passes.

## RED Evidence

- Codex review reported that using `linkedGapSample` for repair planning can choose a later repair start when there are more than ten linked gaps and a sampled-out gap points to an earlier expected index.

## GREEN Evidence

- Added `linkedRepairIndex`, computed over all linked gaps before truncating `linkedGapSample`.
- Updated action repair planning to use `linkedRepairIndex` instead of the bounded diagnostic sample.
- Added a regression test where the earliest linked repair index comes from a gap outside the first ten sampled gaps.
- Validation passed:
  - `pnpm --filter @zeko/actions-indexer exec vitest run test/action-index-integrity.test.ts test/action-repair.test.ts`
  - `moon run actions-indexer:lint -f`
  - `moon run actions-indexer:typecheck -f`
  - `moon run actions-indexer:build -f`
