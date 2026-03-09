---
id: T046
title: "Separate indexer benchmark modules and fix docker integration DB setup"
status: done
blockedBy: [T045]
owner: codex
created_at: 2026-03-06T12:08:00Z
updated_at: 2026-03-06T12:12:20Z
---

## Scope

Separate benchmark modules from CLI command modules into a dedicated directory and fix the docker-backed integration suite DB bootstrap path.

## TDD Exception

This task is a source-layout refactor plus integration harness setup fix. Validation relies on moon typecheck/lint/benchmark/stress and the docker-backed integration test command.

## GREEN Evidence

```bash
moon run actions-indexer:typecheck -f
moon run actions-indexer:lint -f
moon run actions-indexer:bench-action-processing -f
moon run actions-indexer:stress-action-processing -f
pnpm --filter @zeko/actions-indexer exec vitest run test/action-processing.interface.test.ts test/action-processing.bench.interface.test.ts test/action-processing.bench.workflow.test.ts test/action-processing.stress.workflow.test.ts test/cli.resources.test.ts
moon run actions-indexer:test-service-integration -f
```

Result:

- Benchmark modules are separated into `src/benchmark/*`; CLI command wiring remains in `src/cli/*`.
- Docker-backed integration suite now passes DB bootstrap by using `drizzle-kit push` instead of the outdated `drizzle-kit migrate` path.
- Integration suite now fails later at service startup with a runtime issue under Node 24 (`Elysia` WebStandard adapter does not support `listen`), with full logs captured by the test harness.
