---
id: T402
title: "Standardize wallet env files"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T06:55:05Z
updated_at: 2026-06-20T05:17:23Z
---

## Requirements

- Keep all local wallet env files in the monorepo root using `.env.wallet.${name}` filenames.
- Each wallet file must use the same variable names: `PUBLIC_KEY` and `MINA_PRIVATE_KEY`.
- Do not add Bridge CLI wallet-file loading logic; documented commands must select wallets by sourcing the chosen env file before invoking the CLI.
- Add an ignored `.env.backup` and keep all `.env.wallet.*` files ignored.
- Add a TypeScript utility that creates a fresh root wallet file with a timestamped name and both required variables.
- Update the bridge debugging/live-validation runbook to require fresh timestamped wallet files for normal tests, funding the fresh wallet from the validator wallet, and additionally testing locally with the validator wallet when the latest validator run failed.
- Migrate existing local wallet secrets out of regular `.env` files into root wallet files and confirm the created wallet files derive to the expected public keys without printing private keys.

## Test Plan

- TDD: add tests for the wallet-file utility first, covering timestamped file naming, `PUBLIC_KEY`/`MINA_PRIVATE_KEY` output, refusal to overwrite existing files, and root-directory placement.
- RED evidence should show the tests fail before the utility exists.
- GREEN evidence should include the focused tests, bridge-cli typecheck, and local wallet-file confirmation.

## RED Evidence

- `moon run bridge-cli:test -f` after adding `tests/create-wallet-env.test.ts`: existing suites passed; new suite failed with `Cannot find module '../scripts/create-wallet-env'`, proving the wallet-file utility does not exist yet.

## GREEN Evidence

- `moon run bridge-cli:test -f`: 23 test files passed, 120 tests passed, 13 skipped.
- `moon run bridge-cli:typecheck -f`: passed.
- `moon run bridge-cli:lint -f`: passed.
- `moon run bridge-cli:create-wallet-env -f -- --name smoke-final`: passed, created a timestamped root wallet file and printed only the public key; smoke file was removed after validation.
- `moon run bridge-validator:test -f`: 4 test files passed, 39 tests passed.
- `moon run bridge-validator:typecheck -f`: passed.
- `moon run bridge-validator:lint -f`: passed.
- After making `BRIDGE_VALIDATOR_WALLET_ENV_FILE` work from `.env` as documented, reran `moon run bridge-validator:test -f`, `moon run bridge-validator:typecheck -f`, and `moon run bridge-validator:lint -f`: all passed.
- Local wallet migration confirmation: `.env.wallet.bridge-0`, `.env.wallet.validator`, `.env.wallet.sdk-local`, and `.env.wallet.faucet` all derive to their declared `PUBLIC_KEY` values; `.env.backup` exists; `git check-ignore` confirms `.env.wallet.*` and `.env.backup` are ignored; scanning regular `.env` files found no migrated wallet variables.
