---
id: T284
title: "Fix repair delete and scan cost"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-08T17:39:00Z
updated_at: 2026-06-08T17:42:00Z
---

## Requirements

- Address Codex review findings after the linked-gap repair fix.
- Ensure repair-tail deletion does not fail on self-referential `before_state` foreign keys.
- Avoid reading every action row on every indexer tick while still self-healing existing sparse state after deployment.

## Test Plan

- TDD: Add focused tests for the repair scan throttle and preserve the existing no-mutation-before-fetch tests. Use typecheck/build to validate the updated delete query shape.

## RED Evidence

- Codex review reported that deleting `index >= repairIndex` directly can trip `ON DELETE restrict` self-referential foreign keys.
- Codex review reported that handlers running a full integrity scan every 15-second tick adds unbounded steady-state cost.

## GREEN Evidence

- Repair-tail deletion now clears `before_state` for the tail inside the repair transaction before deleting rows, so internal self-references do not block the tail delete.
- Outer and inner handlers run the full integrity repair scan on first process run, then throttle steady-state checks instead of scanning every indexing loop.
- Added a focused throttle test.
- Validation passed:
  - `pnpm --filter @zeko/actions-indexer exec vitest run test/action-index-integrity.test.ts test/action-repair.test.ts`
  - `moon run actions-indexer:lint -f`
  - `moon run actions-indexer:typecheck -f`
  - `moon run actions-indexer:build -f`
