---
id: T211
title: "Rebase CLI refactor on d8eb96b"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T04:01:19Z
updated_at: 2026-05-13T04:09:30Z
---

## Requirements

- Restore the bridge CLI implementation to the `d8eb96b` baseline rather than continuing from the later rewrite/split commits.
- Use the lessons from the rejected rewrites to improve that baseline by removing architecture that does not clarify the CLI:
  - do not carry forward the single-file rewrite,
  - do not carry forward the flat split as implemented in `d33f17b`,
  - keep the useful `d8eb96b` decision/status/instrumentation tests,
  - simplify runtime flow where abstractions are ceremony rather than behavior.
- Keep public CLI behavior, flags, JSON contracts, persisted session shape, retry behavior, package boundary, and build output entrypoint unchanged.
- Keep `packages/bridge-sdk` untouched.
- Update PR #173 after validation.

## Test Plan

- Test Strategy Exception: this is a corrective internal refactor against an existing behavior suite and there is no new end-user behavior to define RED-first. Correctness will be guarded by restoring the `d8eb96b` focused tests plus the existing bridge-cli behavior/package-boundary tests, then validating with typecheck, test, lint, build, `git diff --check`, and an explicit no-SDK-diff check.

## RED Evidence

- Test Strategy Exception recorded before source edits.

## GREEN Evidence

- Restored `packages/bridge-cli` to the `d8eb96b` baseline and removed the later flat/single-file rewrite leftovers.
- Removed the CLI xstate runner/state-controller layer from that baseline:
  - deleted `src/core/operation-machine.ts`,
  - deleted `tests/operation-machine.test.ts`,
  - removed the `xstate` dependency from `packages/bridge-cli/package.json`,
  - replaced the bridge runner state machine with an explicit step loop in `src/commands/bridge.ts`.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:test -f` passed: 20 test files, 95 passed, 13 skipped.
- `moon run bridge-cli:lint -f` passed.
- `moon run bridge-cli:build -f` passed.
- `git diff --check` passed.
- `git diff -- packages/bridge-sdk --stat` produced no output.
