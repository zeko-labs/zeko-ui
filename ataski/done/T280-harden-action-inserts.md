---
id: T280
title: "Harden action inserts"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-08T16:52:07Z
updated_at: 2026-06-08T17:05:00Z
---

## Requirements

- Prevent `outer_actions` and `inner_actions` inserts from silently skipping rows that have precomputed protocol indexes.
- Replace silent conflict ignoring for action-chain rows with fail-fast behavior or explicit conflict detection that aborts the batch before later rows can leave numeric holes.
- Preserve safe insertion behavior for dependent detail tables only if it cannot create action-index holes.
- Add automated tests proving:
  - dense index invariant: `count == max(index) - min(index) + 1`;
  - linked adjacent action states imply adjacent numeric indexes;
  - duplicate/conflicting action rows cannot silently create index holes.
- Use Moon task entrypoints from the repository root for validation.

## Test Plan

- TDD: First add failing tests that reproduce a sparse action-index chain caused by a conflicting row. Then update the insert path and invariant helpers until the tests pass.

## RED Evidence

- Current `batchInsert` uses `db.insert(table).values(chunk).onConflictDoNothing()`, which allows an `outer_actions` or `inner_actions` conflict to skip the conflicting row while later rows keep their precomputed indexes.
- Existing indexer tests do not cover dense index invariants or linked-state adjacency for action tables.

## GREEN Evidence

- `batchInsert` no longer calls `onConflictDoNothing()`, so unique/foreign-key conflicts propagate out of the insert statement and roll back the surrounding indexer transaction.
- Added `analyzeActionIndexIntegrity`, `getActionIndexIntegritySnapshot`, and assertion helpers to detect sparse numeric indexes and linked-state rows whose numeric indexes are not adjacent.
- Added `test/action-index-integrity.test.ts` covering sparse numeric indexes, linked-state numeric gaps, and conflict propagation without silent ignore behavior.
- Validation passed:
  - `pnpm --filter @zeko/actions-indexer exec vitest run test/action-index-integrity.test.ts`
  - `moon run actions-indexer:lint -f`
  - `moon run actions-indexer:typecheck -f`
