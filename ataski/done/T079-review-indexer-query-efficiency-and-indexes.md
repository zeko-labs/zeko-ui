---
id: T079
title: "Review indexer query efficiency and indexes"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T17:42:56Z
updated_at: 2026-03-11T17:56:00Z
---

## Requirements

- Review the new indexer queries added in this PR for efficiency and access patterns against the current schema and indexes.
- Determine whether the current indexes already support the queries adequately or whether new/changed indexes are warranted.
- Implement only the index or query changes that are justified by the actual predicates/orderings in use.
- Document the outcome in the task evidence, including any reviewed findings that were intentionally rejected.

## Test Plan

- DDD
- Inspect the schema/index definitions, the new query predicates, and where reasonable run targeted query-level validation or typecheck coverage for any code changes.
- Re-run `moon run actions-indexer:typecheck -f` and the focused indexer Vitest coverage if query code changes.

## RED Evidence

## Test Strategy Exception

This task is primarily a performance and schema review over query/index fit. The first step is inspection and validation of the actual access paths; only if that review shows a real deficiency will code or schema changes be made and then validated with focused checks.

## GREEN Evidence

- Reviewed the new WEB-395 queries in `services/actions/indexer/src/db.ts` against the current schema in `services/actions/api/drizzle/schema.ts`.
- `promoteCanonicalActions` is already efficient with the existing `after_state` primary key because it updates by `afterState IN (...)` and only touches rows where `marked_as_canonical_at IS NULL`.
- `countNonCanonicalTail` is already bounded by `lastFinalIndex`; after the canonical-promotion fix, the null tail is expected to stay within the finality window rather than growing unbounded, so the current `index` access path is sufficient.
- `getOuterActionsFromBlock` / `getInnerActionsFromBlock` still filter by `block_height >= startBlock` without a dedicated `block_height` index, but after the starvation fix the scanned range is intentionally bounded to the recent canonical window. A new `block_height` index would not satisfy the required `ORDER BY index`, and the current table sizes do not justify the extra write and migration cost yet.
- Tightened the only clearly wasteful query: `getLastFinalOuterAction` and `getLastFinalInnerAction` now select only `afterState`, `index`, `blockHeight`, and `markedAsCanonicalAt` instead of fetching whole rows including the large `fields` payload.
- Conclusion: no new or changed database indexes are warranted in this PR. The query-shape change in `getLastFinal*Action` was implemented; schema and migration files were intentionally left unchanged.
- Validation:
  - `moon run actions-indexer:typecheck -f`
