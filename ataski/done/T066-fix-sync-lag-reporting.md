---
id: T066
title: "Fix sync lag reporting"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T00:00:00Z
updated_at: 2026-03-11T10:20:38Z
---

## Scope

Adjust the actions-indexer sync diagnostic so it does not report a misleading lag when the archive has advanced but there are no pending actions for the indexed stream.

## RED

- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.checks.test.ts`
  - Failed. `runSyncCheck` does not expose `tipDistance`, and the current result shape treats raw tip distance as `lag` even when `hasPendingActions` is `false`.

## GREEN

- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.checks.test.ts`
  - Passed.
- `moon run actions-indexer:typecheck -f`
  - Passed.
- `moon run actions-indexer:lint -f`
  - Passed.
- `moon run actions-indexer:diagnose-sync -- --url https://indexer.actions.zeko.io --json`
  - Passed against the live service. Streams now expose `tipDistance`, and `lag` is `0` when `hasPendingActions` is `false`.
