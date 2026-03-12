---
id: T071
title: "Fix indexer canonical progression and diagnostics"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T15:53:04Z
updated_at: 2026-03-11T17:04:16Z
---

## Requirements

- Add idempotent helpers in `services/actions/indexer/src/db.ts` to promote existing `outer_actions` and `inner_actions` rows from `marked_as_canonical_at = null` to a timestamp when a later fetch proves those actions are final.
- Wire the promotion step into both indexer handlers after `handleFork` returns so re-fetched actions can advance the canonical cursor without requiring a rebuild.
- Extend the indexer status/diagnostic surface with canonical-progress details for both streams. The diagnostics must expose enough information to confirm that the last final action and trailing non-canonical tail are moving forward.
- Keep the changes scoped to indexer progression and diagnostics. Do not change bridge-ui-facing APIs in this task.

## Test Plan

- DDD
- Add focused indexer coverage that seeds rows with `marked_as_canonical_at = null`, promotes them with the new helper, and proves the last-final cursor advances.
- Add coverage for the new canonical-progress diagnostic fields so regressions are visible in status/health/CLI output.
- Record RED evidence before source edits, then GREEN evidence with the targeted tests plus `moon run actions-indexer:typecheck -f`.

## RED Evidence

## Test Strategy Exception

This fix changes existing indexer progression behavior across the handler, DB, and diagnostics surfaces. There is no current focused failing test that isolates the production starvation path without first adding new test scaffolding. The implementation will add targeted coverage immediately after the new seams exist, and GREEN evidence must include those targeted tests plus `moon run actions-indexer:typecheck -f`.

## GREEN Evidence

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/actions AUTH_TOKEN=test-token L1_ARCHIVE_URL=http://127.0.0.1:1/graphql L2_ARCHIVE_URL=http://127.0.0.1:1/graphql OUTER_PK=test-outer INNER_PK=test-inner pnpm --filter @zeko/actions-indexer exec vitest run test/canonical-progress.test.ts test/health.monitor.test.ts`
  - Passed in the task worktree before merge.
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/actions AUTH_TOKEN=test-token L1_ARCHIVE_URL=http://127.0.0.1:1/graphql L2_ARCHIVE_URL=http://127.0.0.1:1/graphql OUTER_PK=test-outer INNER_PK=test-inner pnpm --filter @zeko/actions-indexer exec vitest run test/indexer.test.ts test/canonical-progress.test.ts test/health.monitor.test.ts`
  - Passed on the canonical branch after merges.
- `moon run actions-indexer:typecheck -f`
  - Passed on the task worktree and again on the canonical branch after merges.
