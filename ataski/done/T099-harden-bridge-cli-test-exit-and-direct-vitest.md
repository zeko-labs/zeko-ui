---
id: T099
title: "Harden bridge-cli test exit and direct Vitest runs"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T08:55:00Z
updated_at: 2026-03-19T09:00:00Z
---

## Requirements

- Verify whether the reported hanging terminal is caused by a real test hang or by test runner configuration.
- Make `packages/bridge-cli` test runs self-contained so direct `vitest run` does not depend on prebuilt workspace artifacts.
- Ensure automated tests fail fast instead of waiting indefinitely when a test or hook truly hangs.
- Preserve the existing `moon run bridge-cli:test` workflow.

## Test Plan

- DDD.
- RED path:
  - run `pnpm --dir packages/bridge-cli exec vitest run --config vitest.config.ts`
  - confirm the direct package-local run is not self-contained and can fail due to workspace artifact resolution
- GREEN path:
  - rerun `pnpm --dir packages/bridge-cli exec vitest run --config vitest.config.ts`
  - rerun `moon run bridge-cli:test`
  - confirm both exit cleanly and the package-local run no longer depends on prebuilt workspace dist outputs

## RED Evidence

- `pnpm --dir packages/bridge-cli exec vitest run --config vitest.config.ts` was not self-contained before the fix.
- The direct run failed with workspace resolution errors from `packages/bridge-sdk/dist/index.js`, including:
  - `Cannot find package '@zeko-labs/graphql' imported from .../packages/bridge-sdk/dist/index.js`
- `moon run bridge-cli:test` already exited cleanly, which showed the report of a hanging terminal was not caused by a permanently stuck test in the main Moon workflow.
- The package-local Vitest config had no explicit `testTimeout`, `hookTimeout`, or `teardownTimeout`, so a future leaked timer or hung hook could wait indefinitely.

## GREEN Evidence

- Updated `packages/bridge-cli/vitest.config.ts` to resolve `@zeko-labs/bridge-sdk` and `@zeko-labs/graphql` to workspace source during tests, making direct package-local Vitest runs independent of prebuilt `dist` artifacts.
- Added explicit Vitest `testTimeout`, `hookTimeout`, and `teardownTimeout` values of 10 seconds so a real hang now fails instead of idling in the terminal indefinitely.
- Re-ran `pnpm --dir packages/bridge-cli exec vitest run --config vitest.config.ts`: passed, 17 files / 78 tests, process exited normally.
- Re-ran `moon run bridge-cli:test`: passed, 17 files / 78 tests, process exited normally.
