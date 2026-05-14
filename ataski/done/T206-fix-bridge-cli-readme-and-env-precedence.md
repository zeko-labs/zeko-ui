---
id: T206
title: "Fix bridge CLI README and env precedence"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T06:03:27Z
updated_at: 2026-05-13T06:06:17Z
---

## Requirements

- Update the public bridge CLI README for npm users by removing low-value package-boundary commentary, disabled-route listings, and unclear protocol wording.
- Make the recommended `bridge` command examples more prominent for both enabled directions.
- List the available commands directly before documenting flags.
- Mark `--account` as optional and explain that it is derived from `MINA_PRIVATE_KEY` by default.
- Clearly state that deposits and withdrawals can legitimately take hours while the command remains open.
- Change bridge CLI env loading so explicitly provided shell variables take precedence over dotenv files.
- Preserve current CLI command behavior except for the intended env precedence fix.

## Test Plan

- TDD: add a focused env-loader test that fails under the current precedence behavior by asserting an inherited `MINA_PRIVATE_KEY` is not overwritten by a loaded dotenv value.
- Existing README checks are manual review plus command/test validation.

## RED Evidence

- `pnpm exec vitest run tests/env.test.ts` from `packages/bridge-cli` failed as expected before the implementation change: inherited `MINA_PRIVATE_KEY` was overwritten by the first dotenv file (`expected 'home-wallet' to be 'global-wallet'`).

## GREEN Evidence

- `pnpm exec vitest run tests/env.test.ts` from `packages/bridge-cli`: 3 tests passed.
- `moon run bridge-cli:typecheck -f`: passed.
- `moon run bridge-cli:lint -f`: passed.
- `moon run bridge-cli:test -f`: 21 files passed, 101 tests passed, 13 skipped.
- `moon run bridge-cli:build -f`: passed.
