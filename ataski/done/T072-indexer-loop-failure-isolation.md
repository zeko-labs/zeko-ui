---
id: T072
title: "Isolate outer and inner indexing loop failures"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T15:53:04Z
updated_at: 2026-03-11T17:04:16Z
---

## Requirements

- Refactor `services/actions/indexer/src/indexer.ts` so outer and inner handlers are processed independently in each loop iteration.
- Preserve successful stream progress when the other stream fails: successful results must still update `lastFetchedBlock` and contribute to status snapshots.
- Apply loop backoff only when both streams fail in the same iteration, while preserving the existing missing-parent logging semantics for failures.
- Keep the change local to loop orchestration and associated tests.

## Test Plan

- BDD
- Add tests that simulate outer success with inner failure and inner success with outer failure, asserting the successful stream still updates state.
- Add coverage for the both-fail path to verify that error counting/backoff still occurs only for full-loop failure.
- Record RED evidence before source edits, then GREEN evidence with targeted tests plus `moon run actions-indexer:typecheck -f`.

## RED Evidence

## Test Strategy Exception

The current loop orchestration does not expose a narrow existing failing test seam for partial-success behavior. This task will add focused tests around the refactored loop behavior, and GREEN evidence must include those tests plus `moon run actions-indexer:typecheck -f`.

## GREEN Evidence

- `./node_modules/.bin/vitest run test/indexer.test.ts`
  - Passed in the task worktree before merge: 1 file, 5 tests.
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/actions AUTH_TOKEN=test-token L1_ARCHIVE_URL=http://127.0.0.1:1/graphql L2_ARCHIVE_URL=http://127.0.0.1:1/graphql OUTER_PK=test-outer INNER_PK=test-inner pnpm --filter @zeko/actions-indexer exec vitest run test/indexer.test.ts test/canonical-progress.test.ts test/health.monitor.test.ts`
  - Passed on the canonical branch after merges, including the loop-orchestration coverage in `test/indexer.test.ts`.
- `moon run actions-indexer:typecheck -f`
  - Passed in the task worktree and again on the canonical branch after merges.
