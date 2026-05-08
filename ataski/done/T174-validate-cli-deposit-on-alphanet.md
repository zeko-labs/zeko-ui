---
id: T174
title: "Validate CLI deposit on alphanet"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T22:08:11Z
updated_at: 2026-05-07T00:35:00Z
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
  - `moon run bridge-sdk:finalizeDeposit -f` finalized the deposit through the SDK example with hash `5Ju3XCjemWhkAt6q3nLHa7rT4edRSNgqLawL6WyNivcd9TX5rz6T`.
- Live CLI end-to-end validation with `HOME=/tmp/zeko-bridge-cli-home-pr167-cli-proof` and the local actions API:
  - Operation `3e5d0824-24c1-4642-9ea5-8a14e2be1226` submitted a fresh 1 MINA deposit with hash `5JuJxEo9pnepuYJaLPQrZ2myb443YzFjkQY6AyrCwm4ygRR8MnJ8`.
  - The CLI resumed the operation after rebuild, waited through protocol finality, and finalized with hash `5Ju1uxanDuuZH7VpzvHYw6VCk2jEhYFvbDFt2ZZdSnzy265Nh87w`.
  - Final JSON status returned `status: "completed"`, `phase: "completed"`, `target_index: 8959`, `pending_ahead: 0`, and `next_action: "completed"`.
  - `moon run bridge-sdk:fetchOuterActions -f` confirmed both live deposits report `finalised: true`; `moon run bridge-sdk:canFinalizeDeposit -f` returned `available: false` / `No finalizable deposit found`.
