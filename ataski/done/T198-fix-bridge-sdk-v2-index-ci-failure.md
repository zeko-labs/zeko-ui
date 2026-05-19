---
id: T198
title: "Fix bridge SDK V2 index CI failure"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T12:19:57Z
updated_at: 2026-05-13T12:21:49Z
---

## Requirements

- Fix PR #175 CI by making `bridge-sdk:test` pass after introducing V2 deposit and withdrawal start-index filtering.
- Preserve `Bridge.init` behavior that derives the testnet V2 start indices from `config.l2Network`.
- Keep direct `Bridge` construction in focused tests valid without forcing every test fixture to know production migration offsets.
- Ensure `uint32Max` compares `UInt32` values by converting the `o1js` `Bool` result to a native boolean before choosing the return value.

## Test Plan

- TDD: use the current failing `moon run bridge-sdk:test -f` run as the RED path for the constructor regression, then add a focused `uint32Max` assertion that fails against the current helper implementation before fixing it.
- GREEN validation will rerun `moon run bridge-sdk:test -f`, then `moon run bridge-sdk:typecheck -f`.

## RED Evidence

- `moon run bridge-sdk:test -f` failed before source edits: 2 test files failed, 9 tests failed. The failing tests all crash at `packages/bridge-sdk/src/utils.ts:484` with `TypeError: Cannot read properties of undefined (reading 'greaterThan')`, reached from deposit cancellation/finalization and withdrawal finalization paths.
- After adding the focused regression test, `pnpm --dir packages/bridge-sdk exec vitest run test/utils.test.ts` failed: `uint32Max(UInt32.from(1), UInt32.from(3))` returned `1n` instead of `3n`.

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed: 5 test files passed, 27 tests passed, including the new `test/utils.test.ts` regression.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon ci` passed for affected targets: `bridge-sdk:format`, `bridge-sdk:lint`, `bridge-sdk:build`, `bridge-sdk:typecheck`, and `bridge-sdk:test`. `bridge-sdk:lint` reported existing `noExplicitAny` warnings in `src/types.ts` but exited successfully.
