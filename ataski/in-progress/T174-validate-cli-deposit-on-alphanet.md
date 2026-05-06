---
id: T174
title: "Validate CLI deposit on alphanet"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-06T22:08:11Z
updated_at: 2026-05-06T22:49:00Z
---

## Requirements

- Make the Bridge CLI use the same alphanet endpoint configuration as the working bridge-sdk examples for the enabled Mina-to-Zeko testnet route.
- Use the wallet configured in `packages/bridge-cli/.env` without printing the private key.
- Validate a real Mina devnet to Zeko alphanet deposit with the CLI after the config is corrected.
- Keep unrelated local `apps/bridge-ui/machines/helpers.ts` endpoint edits out of this task.

## Test Plan

- BDD: first update the CLI SDK config test to express the user-visible requirement that the enabled testnet route targets alphanet, then run the focused CLI test and record the expected failure.
- After implementation, run the focused CLI tests, build the CLI, and execute the live CLI deposit flow against alphanet with the configured wallet.

## RED Evidence

- `moon run bridge-cli:test -f -- sdk-config.test.ts` failed as expected after changing the supported route expectation to alphanet. The failure showed `createSdkConfig` still returned `https://gateway.mina.devnet.zeko.io` / testnet defaults instead of the bridge-sdk alphanet endpoints.

## GREEN Evidence

- `moon run bridge-cli:test -f -- sdk-config.test.ts adapter.test.ts` passed with 8 tests.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:lint -f` passed.
- `moon run bridge-cli:build -f` passed.
- Local actions stack validation:
  - `moon run actions-api:services-start -f` started Postgres on `localhost:5434`.
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/actions moon run actions-api:db-migrate -f` applied migrations.
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/actions ENVIRONMENT=local moon run actions-api:dev -f` started the API on `http://localhost:9100`.
  - `actions-indexer:start` indexed alphanet outer actions through at least index `8955`.
  - `curl http://localhost:9100/health` returned healthy and `query { __typename }` returned `Query`.
- Live CLI validation with the wallet from `packages/bridge-cli/.env` and `HOME=/tmp/zeko-bridge-cli-home-pr167`:
  - Submitted Mina devnet to Zeko alphanet deposit operation `73180897-6b41-4ab2-9425-99c1cc0a9fdd`.
  - Submit hash: `5JtkFvSKHBecRJaSezyRERSB6j9wHqVDkgdMu7AmjLP5hS6R7cJR`.
  - The CLI no longer attempts to parse the SDK result hash as JSON.
  - The deposit is visible through the local actions API at outer index `8951`.
  - Resume is currently waiting on protocol finalization state. At L1 slot `809255`, the local indexed commits that can synchronize the deposit have upper slot ranges `809267` through `809274`, so `canFinalizeDeposit` still reports `Earlier deposit must be resolved first`.
