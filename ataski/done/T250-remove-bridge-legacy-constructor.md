---
id: T250
title: "Remove Bridge legacy constructor"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-21T08:11:10Z
updated_at: 2026-05-21T08:22:21Z
---

## Requirements

- Remove the legacy positional `new Bridge(config, clients, keys, fees, ...)` constructor compatibility path from PR 171.
- Keep `Bridge.init(config)` as the normal public setup path.
- Keep direct `new Bridge(runtime)` construction available for internal tests and extracted module wiring.
- Remove the legacy-constructor runtime guard and test coverage added only to support positional compatibility.
- Update bridge SDK tests to construct `Bridge` through a `BridgeRuntime` object instead of positional legacy arguments.
- Preserve the previous review fixes that are still valid: L2 archive endpoint, prover payload errors, finalize deposit hook consistency, shared transaction types, explicit bridge fee literal, and named skipped withdrawal index.

## Test Plan

- TDD.
- RED: run bridge SDK typecheck/tests before implementation to show the current suite still depends on the legacy constructor path.
- GREEN: remove the legacy overload/path, update tests to runtime construction, then run `moon run bridge-sdk:test -f`, `moon run bridge-sdk:typecheck -f`, `moon run bridge-sdk:build -f`, `moon run bridge-sdk:format -f`, and `moon run bridge-sdk:lint -f`.

## RED Evidence

- `pnpm exec vitest run test/bridge-constructor.test.ts` failed after changing the expectation to reject the full legacy positional constructor:
  - `Bridge constructor > rejects the legacy constructor signature`
  - failure: `expected [Function] to throw an error`
  - This proves the current branch still accepts the compatibility path the user asked to remove.

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed:
  - 10 test files passed.
  - 46 tests passed.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-sdk:build -f` passed.
- `moon run bridge-sdk:format -f` passed.
- `moon run bridge-sdk:lint -f` completed with the existing `packages/bridge-sdk/src/types.ts:121` `noExplicitAny` warning and no blocking errors.
