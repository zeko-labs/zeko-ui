---
id: T286
title: "Block indexing after repair failure"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-08T17:53:00Z
updated_at: 2026-06-08T17:56:00Z
---

## Requirements

- Address the Codex review finding that a failed action-index repair can advance the integrity-check throttle and allow normal indexing to continue on a sparse chain.
- If `outer_actions` or `inner_actions` drift is detected, normal indexing must not run until repair succeeds or the stream is confirmed dense.
- Failed archive/node repair attempts must leave the DB untouched and retry on the next loop rather than waiting for the steady-state throttle window.
- Preserve throttled full-table checks for dense/no-op steady-state runs.
- Add focused regression coverage for the no-fallthrough behavior.

## Test Plan

- TDD: Use the Codex review finding as RED evidence, add a shared guard regression test that fails if a sparse repair failure can return an advanced throttle checkpoint, then update the handlers to route through that guard before normal indexing.

## RED Evidence

- Codex review reported that `lastIntegrityCheckAt` is updated before `repairActionIndexDrift` completes. If archive fetching fails during repair, the next indexer tick can skip integrity repair for up to five minutes and run normal `handleFork` against the still-sparse action chain.

## GREEN Evidence

- Added `checkAndRepairActionIndexDrift`, which only returns an advanced throttle timestamp after a skipped check, dense no-op check, or successful repair. Failed repairs throw before returning an updated timestamp.
- Updated outer and inner handlers to call the shared guard before normal indexing. A failed repair now rejects the handler and lets the loop retry repair instead of falling through to `handleFork`.
- Added regression tests covering throttle preservation inside the steady-state window, dense no-op throttle advancement, and failed repair propagation without transaction/delete/insert mutation.
- Validation passed:
  - `pnpm --filter @zeko/actions-indexer exec vitest run test/action-index-integrity.test.ts test/action-repair.test.ts`
  - `moon run actions-indexer:typecheck -f`
  - `moon run actions-indexer:lint -f`
  - `moon run actions-indexer:build -f`
