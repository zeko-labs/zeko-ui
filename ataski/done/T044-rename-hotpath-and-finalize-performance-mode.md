---
id: T044
title: "Rename hotpath module and finalize fastest execution mode"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-05T17:42:30Z
updated_at: 2026-03-05T18:09:33Z
---

## Scope

Rename the `hotpath` naming to a clearer module name, keep the highest-performing execution mode as default based on benchmark data, and finalize commit/push.

## TDD Exception

This task is primarily a cross-cutting rename/refactor and command wiring update over existing tested behavior, plus benchmark-driven configuration selection. Validation will rely on full typecheck/lint/build, benchmark/stress commands, and existing hotpath test suite.

## GREEN Evidence

```bash
moon run actions-indexer:typecheck -f
moon run actions-indexer:lint -f
moon run actions-indexer:bench-action-processing -f
moon run actions-indexer:stress-action-processing -f
pnpm --filter @zeko/actions-indexer exec vitest run test/action-processing.interface.test.ts test/action-processing.bench.interface.test.ts test/action-processing.bench.workflow.test.ts test/action-processing.stress.workflow.test.ts
```

Result:

- All commands pass.
- Renamed `hotpath` terminology to `action-processing` across module paths, CLI, moon tasks, tests, and docs.
- Kept subprocess parallel execution as the default fast path.
- Benchmark confirms performance mode remains best: main `~3074ms`, action-processing workers `~1020ms` (`~3.0x` speedup), fallback count `0`.
