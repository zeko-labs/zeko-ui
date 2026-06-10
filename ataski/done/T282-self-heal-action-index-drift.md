---
id: T282
title: "Self-heal action index drift"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-09T04:20:00Z
updated_at: 2026-06-09T04:26:00Z
---

## Requirements

- Make the indexer self-heal sparse `outer_actions` and `inner_actions` indexes by repairing from the last known-good prefix.
- If action indexes are sparse or linked action-state rows are numerically non-adjacent, compute the earliest broken index and rebuild from that point using archive data.
- Do not mutate indexed tables until archive/node data needed for the repair has been fetched and validated. If nodes/archive are unavailable, leave the DB untouched and retry later.
- Preserve transactional repair: delete the broken tail and insert the rebuilt dense tail in one transaction.
- Surface action-index integrity and repair status in logs/health so operators can see when the indexer is repairing or waiting for archive recovery.
- Add tests for repair planning and the no-mutation-on-archive-failure behavior.

## Test Plan

- TDD: First document that current integrity helpers are not wired into the loop and cannot repair sparse tables. Add tests that require repair planning to identify the earliest broken index and require failed archive fetches to avoid deletes/inserts, then implement self-healing.

## RED Evidence

- Current integrity helpers are not invoked by `outer.handler` or `inner.handler`, so an existing sparse table is not repaired automatically.
- Existing fork handling mutates only after fetch succeeds for normal indexing, but there is no sparse-tail repair path that can rebuild earlier broken indexes.

## GREEN Evidence

- Added a self-heal repair path that runs before normal outer/inner indexing when action-index integrity detects sparse indexes or linked-state numeric gaps.
- Repair computes the earliest broken index, finds a repair anchor, fetches archive data before opening a transaction, validates that fetched data connects to the last known-good action state, then deletes and reinserts the broken tail transactionally.
- If archive/node fetching fails, no transaction is opened and no indexed action table mutation occurs; the normal indexer retry/backoff behavior handles the failure.
- Validation passed:
  - `pnpm --filter @zeko/actions-indexer exec vitest run test/action-index-integrity.test.ts test/action-repair.test.ts`
  - `moon run actions-indexer:lint -f`
  - `moon run actions-indexer:typecheck -f`
  - `moon run actions-indexer:build -f`
