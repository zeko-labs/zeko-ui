---
id: T048
title: "Fix IPC review findings, simplify tests, and add performance proof workflow"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-09T12:26:43Z
updated_at: 2026-03-09T12:38:54Z
---

## Scope

Address review findings on `task/T043-indexer-cli-diagnostics` by simplifying CLI/runtime code, replacing weak tests with behavior tests, documenting the stdin/stdout IPC approach, and adding a reproducible local proof command showing IPC is faster.

## TDD Plan

1. RED: add/adjust behavior-focused tests that fail under current parsing/runtime behavior.
2. GREEN: implement runtime/CLI/test/docs/proof changes.
3. Validate with moon typecheck/lint/tests and proof command.

## RED Evidence

```bash
pnpm --filter @zeko/actions-indexer exec vitest run test/cli.args.test.ts test/action-processing.proof.test.ts
```

Result: failed as expected with missing modules referenced by new behavior tests:

- `../src/cli/args`
- `../src/benchmark/action-processing-proof`

## GREEN Evidence

```bash
pnpm --filter @zeko/actions-indexer exec vitest run test/cli.args.test.ts test/action-processing.core.test.ts test/action-processing.runtime.test.ts test/action-processing.proof.test.ts test/cli.resources.test.ts test/health.monitor.test.ts
moon run actions-indexer:typecheck -f
moon run actions-indexer:lint -f
moon run actions-indexer:build -f
moon run actions-indexer:test-service-integration -f
moon run actions-indexer:prove-action-processing -f -- --sample-runs 6 --warmup-runs 1 --json
```

Result:

- Behavior-focused test suite passes (12/12).
- Typecheck, lint, and build pass.
- Docker-backed service integration suite passes (3/3).
- IPC proof command passes with `workerFallbackCount = 0` and positive median speedup:
  - main median: `2795.38ms`
  - worker median: `1172.16ms`
  - speedup ratio: `2.38x`
