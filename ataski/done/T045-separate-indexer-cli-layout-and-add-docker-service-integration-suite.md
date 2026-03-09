---
id: T045
title: "Separate indexer CLI layout and add docker service integration suite"
status: done
blockedBy: [T044]
owner: codex
created_at: 2026-03-06T10:13:38Z
updated_at: 2026-03-06T10:16:48Z
---

## Scope

Keep benchmark/stress CLI implementation fully colocated in `src/cli`, remove remaining wrapper indirections, and add a docker-backed service integration suite that validates core indexer features.

## TDD Exception

This task is primarily a source layout refactor and integration harness addition. Validation will rely on typecheck/lint/benchmark/stress and targeted vitest suites, plus the docker integration command where daemon availability permits.

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

- Typecheck, lint, benchmark, stress commands pass.
- Local CLI/module tests pass after removing benchmark/stress wrappers from `scripts/` and importing directly from `src/cli/*`.
- Docker-backed service integration suite is wired and executable, but fails in this environment because Docker daemon is not running (`Cannot connect to docker.sock`).
- Integration failure output now includes structured `stdout`/`stderr` and service logs for easier diagnosis.
