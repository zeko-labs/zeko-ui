---
id: T070
title: "Handle signal-terminated log streams"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T11:35:00Z
updated_at: 2026-03-11T12:20:27Z
---

## Scope

Fix the actions-indexer logs command so stopping a tailed Northflank log stream with `SIGINT` or `SIGTERM` is treated as a normal exit instead of a misleading auth/login failure.

## RED

- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.resources.test.ts`
  - Failed in `resources command > treats SIGINT-terminated log streams as a clean exit`.
  - The logs helper currently treats signal-terminated subprocess exits as code `1`, so the Ctrl+C path does not resolve cleanly.

## GREEN

- `pnpm --filter @zeko/actions-indexer exec vitest run test/cli.resources.test.ts`
  - Passed. The logs helper now treats user-triggered `SIGINT` / `SIGTERM` shutdown as a clean exit.
- `moon run actions-indexer:typecheck -f`
  - Passed.
- `moon run actions-indexer:lint -f`
  - Passed.
