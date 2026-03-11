---
id: T068
title: "Fix indexer reset control race"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T10:40:00Z
updated_at: 2026-03-11T11:09:32Z
---

## Scope

Fix the indexer control lifecycle so `reset` cannot return a spurious `Indexer already running` failure when control requests overlap or when a previous reset is still settling. Keep the work on the existing canonical `T067` branch/worktree.

## RED

- `moon run actions-indexer:test-service-integration -f`
  - Failed in `test/service.integration.test.ts > serializes overlapping reset requests`.
  - Two concurrent authenticated `POST /reset` requests produced an HTTP `500` instead of both succeeding, reproducing the production `Indexer already running` reset race.

## GREEN

- `pnpm --filter @zeko/actions-indexer exec vitest run test/action-processing.runtime.test.ts`
  - Passed.
- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.checks.test.ts`
  - Passed.
- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.resources.test.ts`
  - Passed.
- `moon run actions-indexer:typecheck -f`
  - Passed.
- `moon run actions-indexer:lint -f`
  - Passed.
- `moon run actions-indexer:test-service-integration -f`
  - Passed. The overlapping `reset` regression case now returns HTTP `200` for both requests, and the service remains running afterward.
