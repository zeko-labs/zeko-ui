---
id: T186
title: "Default direct status account"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-07T15:30:47Z
updated_at: 2026-05-07T15:35:42Z
---

## Requirements

- Make `bridge-cli` direct `deposit status` and `withdrawal status` commands default to the active signer account when `--account` is omitted.
- Keep `--account` as an explicit override for inspecting another account.
- Reuse the existing `WALLET_PRIVATE_KEY` signer derivation behavior used by bridge and operation commands.
- Keep the change scoped to CLI status argument parsing and command metadata; do not alter deposit or withdrawal transaction behavior.

## Test Plan

- TDD: first capture the current failing behavior with `node ./dist/cli.js deposit status --json`, which exits before command logic because `--account` is required.
- Add focused CLI command tests proving deposit and withdrawal status derive the public key from `WALLET_PRIVATE_KEY` when `--account` is omitted.
- Run the focused direct-command test file, `bridge-cli:typecheck`, and `bridge-cli:build`.

## RED Evidence

- `node ./dist/cli.js deposit status --json` from `packages/bridge-cli` exits with `Missing required argument: --account`.

## GREEN Evidence

- `pnpm exec vitest run tests/direct-commands.test.ts --pool forks --maxWorkers=1`: 17 tests passed.
- `moon run bridge-cli:lint -f`: passed.
- `moon run bridge-cli:typecheck -f`: passed.
- `moon run bridge-cli:build -f`: passed.
- `node ./dist/cli.js deposit status --json` from `packages/bridge-cli`: succeeded without `--account` and derived account `B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq`.
- `node ./dist/cli.js withdrawal status --json` from `packages/bridge-cli`: succeeded without `--account` and derived account `B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq`.
