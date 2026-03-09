---
id: T042
title: "Add indexer diagnostics CLI and simplify health responsiveness"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-05T16:34:50Z
updated_at: 2026-03-05T16:50:21Z
---

## Scope

Implement a citty-based diagnostics CLI in `services/actions/indexer` with `health`, `sync`, `resources`, and `diagnose` commands.

Keep server responsiveness fix minimal by removing blocking DB checks from the request path and yielding in heavy loops.

## TDD Plan

1. Add failing tests for CLI command behavior and non-blocking health behavior.
2. Implement CLI + server changes.
3. Run moon test/typecheck/build targets and record GREEN evidence.

## RED Evidence

```bash
moon run actions-indexer:typecheck
```

Result: failed as expected with missing modules referenced by new tests:

- `../src/cli/resources`
- `../src/health`

## GREEN Evidence

```bash
moon run actions-indexer:typecheck
pnpm --filter @zeko/actions-indexer exec vitest run test/cli.resources.test.ts test/health.monitor.test.ts
moon run actions-indexer:lint
moon run actions-indexer:build
moon run actions-indexer:cli -- --help
moon run actions-indexer:diagnose-health -- --url https://indexer.actions.zeko.io --timeoutMs 30000
```

Result: all commands passed.
