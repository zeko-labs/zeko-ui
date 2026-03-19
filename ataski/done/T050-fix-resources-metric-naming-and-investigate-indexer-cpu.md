---
id: T050
title: "Fix resources metric naming and investigate indexer CPU saturation"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-09T15:24:10Z
updated_at: 2026-03-09T15:26:38Z
---

## Scope

Fix incorrect Northflank resources metric naming in the actions-indexer diagnostics CLI and investigate why the live deployment is saturating CPU.

## TDD Exception

This task depends on live Northflank metrics, logs, and deployed runtime behavior. A RED unit test cannot determine why the production deployment is CPU-bound.

Validation strategy:

1. Reproduce the metrics output against the live Northflank deployment.
2. Fix the CLI output and documentation to match the real metric semantics.
3. Correlate live CPU with code paths and recommend whether code changes, configuration changes, or instance sizing are required.

## GREEN Evidence

```bash
pnpm --filter @zeko/actions-indexer exec vitest run test/cli.resources.test.ts
moon run actions-indexer:build -f
node dist/cli.js resources --project-id actions-indexer --service-id actions-indexer-deployment --duration-seconds 60 --json
```

Result:

- `cli.resources.test.ts` passed with parsing coverage for CPU and memory percentages.
- the rebuilt CLI now reports `memoryPercent` instead of `memoryMb`.
- live output against Northflank succeeded with the real deployment target (`actions-indexer` / `actions-indexer-deployment`).
- live investigation showed the deployment repeatedly rescans large archive ranges and sometimes times out the worker path, then falls back to main-thread processing.
