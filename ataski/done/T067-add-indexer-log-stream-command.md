---
id: T067
title: "Add indexer log stream command"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T00:00:00Z
updated_at: 2026-03-11T10:33:08Z
---

## Scope

Add a KISS actions-indexer CLI command that streams service logs by wrapping the Northflank CLI under the hood, wire it into moon tasks and docs, and validate it by watching logs while issuing a live reset command.

## RED

- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.resources.test.ts`
  - Failed. `buildNorthflankLogsArgs` does not exist yet, so the logs wrapper path is not implemented.

## GREEN

- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.resources.test.ts`
  - Passed after adding the Northflank logs wrapper argument builder.
- `moon run actions-indexer:typecheck -f`
  - Passed.
- `moon run actions-indexer:lint -f`
  - Passed.
- Live validation:
  - `moon run actions-indexer:logs -- --project-id "$NORTHFLANK_PROJECT_ID" --service-id "$NORTHFLANK_SERVICE_ID" --duration-seconds 300 --line-limit 50 --tail`
  - Confirmed the CLI streams deployed service logs by wrapping the Northflank CLI.
- Reset validation while tailing logs:
  - The deployed service cleared indexed state and resumed syncing from scratch.
  - The authenticated `reset` request still returned HTTP 500 with `Indexer already running`, which indicates an existing reset/start race in the service control path rather than a failure in the new logs command.
