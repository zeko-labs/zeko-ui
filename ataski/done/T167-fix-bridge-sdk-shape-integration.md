---
id: T167
title: "Fix bridge SDK shape integration"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T18:18:10Z
updated_at: 2026-05-06T18:25:49Z
---

## Requirements

- Update bridge UI and bridge CLI integration code to match the current `@zeko-labs/bridge-sdk` exported shape.
- Preserve existing user-facing bridge behavior and diagnostics while removing typecheck/hook failures caused by stale SDK assumptions.
- Keep changes scoped to the UI/CLI SDK boundary and related tests.
- Do not modify unrelated dirty worktree changes.

## Test Plan

- TDD: first run the failing pre-commit/typecheck path to capture current SDK-shape failures.
- Add or update focused unit tests where the integration contract needs tighter coverage.
- GREEN requires the relevant bridge CLI/UI tests and `bridge-ui:typecheck` hook command to pass.

## RED Evidence

- `pnpm exec moon run bridge-ui:typecheck -f` fails in `apps/bridge-ui/machines/operations.worker.ts` with stale bridge SDK call shapes: finalization/cancellation methods expect wallet transaction signing callbacks, several calls pass old sender/fee option objects, and the UI still calls `.toJSON()` on SDK results that are now serialized transaction strings.
- `pnpm exec moon run bridge-cli:typecheck -f` fails in `packages/bridge-cli/src/core/adapter.ts` because the adapter still expects SDK methods to return sendable transactions and passes old fee-payer/options where the SDK now requires signing callbacks and returns serialized transaction strings.

## GREEN Evidence

- `pnpm exec moon run bridge-cli:typecheck -f` passes.
- `pnpm exec moon run bridge-ui:typecheck -f` passes.
- `pnpm exec moon run bridge-cli:test -f` passes: 18 files, 88 tests.
- `pnpm exec moon run bridge-ui:test -f` passes: 10 files, 52 tests.
- `pnpm exec lefthook run pre-commit` passes all hook jobs, including lint-fix, format-all-fix, and `bridge-ui:typecheck`.
