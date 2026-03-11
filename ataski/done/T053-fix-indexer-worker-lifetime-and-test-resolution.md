---
id: T053
title: "Fix indexer worker lifetime and test resolution"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-09T15:47:56Z
updated_at: 2026-03-09T15:59:25Z
---

## Scope

1. Remove worker-process timeout behavior from the actions-indexer action-processing runtime so long-running workloads can complete without forced termination.
2. Fix the direct test/runtime resolution failure so targeted actions-indexer Vitest runs work without the current import-resolution breakage.
3. Tighten repository instructions so the Ataski workflow is explicit about pre-edit task creation, canonical-board updates, and non-reuse of task IDs.

## TDD Exception

The worker-lifetime change removes an operational timeout rather than changing a small deterministic branch. A RED-first unit test for "should not timeout even if work takes a long time" would either hang the suite or rely on artificial mocks that do not exercise the real child-process path.

Validation strategy:

1. Prove the current modular import gap with direct runtime import failures for `@zeko/bridge-sdk/graphql` and `@zeko/bridge-sdk/actions`.
2. Change the bridge SDK to expose narrow subpath entrypoints and update the indexer to use them.
3. Remove the worker-process timeout path and validate the runtime and integration suites.

## RED Evidence

Commands:

1. `cd services/actions/indexer && pnpm exec node -e 'import("@zeko/bridge-sdk/graphql").then(() => console.log("ok")).catch((error) => { console.error(error.message); process.exit(1) })'`
2. `cd services/actions/indexer && pnpm exec node -e 'import("@zeko/bridge-sdk/actions").then(() => console.log("ok")).catch((error) => { console.error(error.message); process.exit(1) })'`

Result:

- `@zeko/bridge-sdk` root import resolved.
- `@zeko/bridge-sdk/graphql` and `@zeko/bridge-sdk/actions` both failed because the package did not export or build those narrow entrypoints.

## GREEN Evidence

Commands:

1. `moon run bridge-sdk:build -f`
2. `moon run actions-indexer:typecheck -f`
3. `moon run actions-indexer:lint -f`
4. `pnpm --filter @zeko/actions-indexer exec vitest run test/action-processing.runtime.test.ts test/cli.resources.test.ts test/bridge-sdk-subpaths.test.ts`
5. `cd services/actions/indexer && pnpm exec node -e 'import("@zeko/bridge-sdk/graphql").then(() => console.log("graphql-ok")).catch((error) => { console.error(error.message); process.exit(1) })' && pnpm exec node -e 'import("@zeko/bridge-sdk/actions").then(() => console.log("actions-ok")).catch((error) => { console.error(error.message); process.exit(1) })'`
6. `moon run actions-indexer:test-service-integration -f`
7. `moon run actions-indexer:prove-action-processing -f -- --sample-runs 4 --warmup-runs 1 --json`

Result:

- Bridge SDK now builds and exports `./graphql` and `./actions` entrypoints.
- Targeted Vitest runs pass without relying on the bridge SDK root entrypoint.
- The worker runtime no longer kills long-running child processes or recursively splits timed-out chunks.
- Docker-backed service integration passed (`4` tests).
- Action-processing proof passed with `workerFallbackCount: 0`, `mainMedianMs: 8686.03`, `workerMedianMs: 5789.46`, and `speedupRatio: 1.5`.
