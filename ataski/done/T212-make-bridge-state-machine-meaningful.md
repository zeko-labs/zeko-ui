---
id: T212
title: "Make bridge state machine meaningful"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T04:16:14Z
updated_at: 2026-05-13T04:25:06Z
---

## Requirements

- Restore `xstate` for the bridge CLI and use it to clarify the long-running bridge lifecycle instead of removing it.
- Keep `packages/bridge-cli` based on the `d8eb96b` structure, not the rejected single-file or flat split rewrites.
- Improve the state-machine usage so the machine names meaningful lifecycle states and routes explicit step outcomes:
  - submit,
  - inspect,
  - wait for submission,
  - wait for prior claims,
  - wait for finalization,
  - finalize,
  - cancel,
  - complete,
  - cancel,
  - fail.
- Do not keep a separate fake state machine whose only purpose is assigning `phase/status`; phase transitions may be represented by explicit transition helpers or real machine actions.
- Preserve public CLI behavior, flags, JSON output, persisted session shape, retry behavior, package boundary, and package artifact boundary.
- Keep `packages/bridge-sdk` untouched.

## Test Plan

- TDD.
- RED: add or restore focused machine-level lifecycle tests that fail on the current explicit-loop implementation because `xstate` is absent, while keeping the behavior suite intact.
- GREEN: restore and improve the xstate bridge operation machine so those machine tests and the existing behavior suite pass.

## RED Evidence

- `pnpm exec vitest run tests/bridge-machine.test.ts` from `packages/bridge-cli`
- Result: RED as intended. The test failed because `bridgeOperationMachine` is not exported/present in the current explicit-loop implementation.

## GREEN Evidence

- `pnpm exec vitest run tests/bridge-machine.test.ts` from `packages/bridge-cli`
  - Result: GREEN, 2 tests passed.
- `moon run bridge-cli:typecheck -f`
  - Result: GREEN.
- `moon run bridge-cli:lint -f`
  - Result: GREEN, Biome checked 55 files with no fixes applied.
- `moon run bridge-cli:test -f`
  - Result: GREEN, 21 files passed, 97 tests passed, 13 skipped.
- `moon run bridge-cli:build -f`
  - Result: GREEN. Build completed; existing tsdown `resolve.tsconfigFilename` deprecation warning remains unrelated.
