---
id: T210
title: "Split bridge CLI by responsibility"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T03:36:13Z
updated_at: 2026-05-13T03:53:30Z
---

## Requirements

- Keep the current bridge CLI public behavior, flags, JSON output shape, persisted session shape, package boundary, and retry behavior.
- Keep `packages/bridge-sdk` untouched.
- Replace the single large `packages/bridge-cli/src/app.ts` implementation with a small set of concrete CLI responsibility modules:
  - executable/root command composition,
  - bridge operation runner,
  - pure queue/lifecycle decisions,
  - SDK adapter/direct SDK calls,
  - persisted session/log/projection/rendering,
  - one-shot direct commands,
  - TUI.
- Do not reintroduce the old `commands/**`, `core/**`, generic service/runtime layers, or xstate state machines.
- Fix any status projection drift found during comparison with `d8eb96b`, including cancellation readiness wording.
- Preserve the package boundary: the built CLI exposes only the entrypoint plus allowed metadata, with no importable internals.

## Test Plan

- TDD.
- RED: restore focused tests for decision logic and operation status projection before implementation, pointed at the new intended behavior boundaries. The projection test must fail on the current `"ready-cancel"` drift and expect the stable `"ready-cancellation"` value.
- GREEN: split the implementation by responsibility, keep the restored tests and existing CLI behavior tests green, then run bridge-cli typecheck, test, lint, and build through Moon.

## RED Evidence

- `pnpm exec vitest run tests/decision-rules.test.ts tests/operation-projection.test.ts` from `packages/bridge-cli`
- Result: RED as intended. `decision-rules.test.ts` passed, and `operation-projection.test.ts` failed because `projectOperationStatus()` returned `"ready-cancel"` instead of the stable `"ready-cancellation"` JSON phase.

## GREEN Evidence

- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:test -f` passed: 8 test files, 56 passed, 13 skipped.
- `moon run bridge-cli:lint -f` passed.
- `moon run bridge-cli:build -f` passed.
- `git diff --check` passed.
- `git diff -- packages/bridge-sdk --stat` produced no output.
