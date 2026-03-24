---
id: T065
title: "Log slow worker chunks as warning"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T00:00:00Z
updated_at: 2026-03-11T10:01:12Z
---

## Scope

Change slow action-processing worker completion observability from raw `stderr` writes to a warning-level application log, while avoiding stdout noise for normal successful worker completions.

## TDD Exception

This is a small logging-semantics adjustment to an already-validated hotfix path. The behavior change is operational rather than functional, so a pre-edit RED test is not the fastest or clearest gate.

Validation strategy:

1. Keep the existing runtime tests green to verify worker success and failure semantics are unchanged.
2. Run actions-indexer typecheck and lint after the logging change.

## GREEN

- `pnpm --filter @zeko/actions-indexer exec vitest run test/action-processing.runtime.test.ts`
  - Passed.
- `moon run actions-indexer:typecheck -f`
  - Passed.
- `moon run actions-indexer:lint -f`
  - Passed.
