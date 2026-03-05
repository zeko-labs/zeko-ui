---
id: T043
title: "Benchmark and optimize actions-indexer hotpath with Node runtime"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-05T17:10:20Z
updated_at: 2026-03-05T17:40:32Z
---

## Scope

Extract the action hashing/validation hotpath into its own module, add a local stress/benchmark workflow, identify the bottleneck, and implement a more robust performance optimization.

Also switch Docker/runtime startup from Bun to Node.js.

## TDD Plan

1. Add RED benchmark/stress harness and tests around extracted hotpath interfaces.
2. Implement extraction + worker-based optimization + Node runtime migration.
3. Record GREEN evidence for benchmark, typecheck, lint, and build.

## RED Evidence

```bash
moon run actions-indexer:typecheck
```

Result: failed as expected with missing modules referenced by new tests:

- `../scripts/hotpath-bench`
- `../src/hotpath/core`

## GREEN Evidence

```bash
moon run actions-indexer:typecheck -f
moon run actions-indexer:lint -f
moon run actions-indexer:bench-hotpath -f
moon run actions-indexer:stress-hotpath -f
pnpm --filter @zeko/actions-indexer exec vitest run test/hotpath.interface.test.ts test/hotpath.bench.interface.test.ts test/hotpath.bench.workflow.test.ts test/hotpath.stress.workflow.test.ts
```

Result:

- Typecheck and lint pass.
- Hotpath bench runs through the built CLI and reports hashing as the bottleneck.
- Hotpath stress runs through the built CLI and confirms worker-path execution with low event-loop lag.
- Vitest hotpath suite passes locally.

## Findings

- Bottleneck is hashing in `processArchiveBlocks`.
- `worker_threads` with o1js failed at runtime (`Cannot read properties of undefined (reading 'memory')` in o1js WASM bindings).
- Replaced thread approach with a parallel subprocess hotpath executor (`hotpath-process`) to avoid o1js worker-thread incompatibility.
- Local benchmark improvement (default workload): main `~3004ms` vs parallel worker path `~1000ms` (`~3.0x` speedup).
- Local stress workflow (default workload): worker runs only, avg run `~651ms`, event-loop lag mean `~22.59ms`.
