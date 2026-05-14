---
id: T205
title: "Bridge CLI cleanup refactor"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T04:30:00Z
updated_at: 2026-05-13T05:22:00Z
---

## Requirements

- Clean up the bridge CLI internals while preserving public CLI behavior, flags, JSON output, persisted session shape, retry behavior, and package boundary.
- Keep `packages/bridge-sdk` behavior from the PR base intact; this task only represents the bridge CLI cleanup work in this branch.
- Keep the CLI package exposing only the built entrypoint.
- Keep the bridge operation flow readable as explicit domain states: route, submit, inspect, wait for submission, wait for prior claims, wait for finalization, finalize, cancel, complete, cancelled, and failed.
- Use xstate as the lifecycle router rather than a decorative phase setter.
- Keep command modules focused on CLI wiring and move reusable command parsing, operation status projection, resume queue discovery, adapter setup, and instrumentation into focused helpers where that removes duplicated policy.

## Test Plan

- TDD for the state-machine correction and focused behavior characterization for queue decisions, instrumentation, command args, operation services, and package boundary.
- Preserve the existing bridge flow behavior suite.

## RED Evidence

- `pnpm exec vitest run tests/bridge-machine.test.ts` from `packages/bridge-cli`
  - Result: RED before restoring xstate lifecycle routing because `bridgeOperationMachine` was not present.

## GREEN Evidence

- `pnpm exec vitest run tests/bridge-machine.test.ts` from `packages/bridge-cli`
  - Result: GREEN, 2 tests passed.
- `moon run bridge-cli:typecheck -f`
  - Result: GREEN.
- `moon run bridge-cli:lint -f`
  - Result: GREEN.
- `moon run bridge-cli:test -f`
  - Result: GREEN, 21 files passed, 101 tests passed, 13 skipped.
- `moon run bridge-cli:build -f`
  - Result: GREEN. Build completed; the existing tsdown `resolve.tsconfigFilename` deprecation warning remains unrelated.
- Review follow-up validation:
  - `pnpm exec vitest run tests/cli.test.ts tests/command-args.test.ts tests/operation-services.test.ts` from `packages/bridge-cli`
  - Result: GREEN, 16 tests passed.
