---
id: T311
title: "Update network nomenclature"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T08:51:04Z
updated_at: 2026-06-12T09:24:46Z
---

## Requirements

- Update repo network IDs to the new canonical naming where applicable:
  - Zeko-M local developer network: `zeko-m-local`
  - Zeko-M development on Mina Devnet: `zeko-m-devnet`
  - Zeko-M pre-mainnet staging on Mina Devnet: `zeko-m-alphanet`
  - Zeko-M production on Mina Mainnet: `zeko-m-mainnet`
  - Zeko-E future Ethereum testnet: `zeko-e-testnet`
  - Zeko-E Ethereum production: `zeko-e-mainnet`
- Preserve compatibility with the backend/o1js requirement that SDK mainnet Zeko network config is sent as `l2Network: { custom: "zeko-mainnet" }`.
- Apply the already-landed CLI mainnet SDK behavior to Bridge UI so the UI mainnet route sends `{ custom: "zeko-mainnet" }` to the SDK backend-facing network configuration.
- Keep route labels and docs aligned with the new nomenclature without changing unrelated endpoints, settlement layers, or deployment behavior.
- Do not manually edit generated `worker-configuration.d.ts` files.

## Test Plan

- TDD: first add or update focused tests to assert the new Bridge UI chain IDs and the mainnet UI SDK config payload, plus any affected faucet/default network tests. Run the focused command and record the failing RED evidence before implementation.
- After implementation, run the same focused tests and at least the relevant project test/typecheck tasks through Moon from the repo root.

## RED Evidence

- `pnpm exec moon run bridge-ui:test -f -- --run test/unit/network-nomenclature.test.ts` failed after adding the RED assertions: `supportedNetworks` still returned `zeko:testnet`/`zeko:mainnet`, mainnet UI SDK config returned `l2Network: "mainnet"` instead of `{ custom: "zeko-mainnet" }`, and Zeko-M explorer URLs resolved to `undefined/tx/...`.
- `pnpm exec moon run bridge-cli:test -f -- --run tests/routes.test.ts` failed after updating route expectations: `resolveRoute` rejected `zeko-m-devnet`, `zeko-m-mainnet`, and `zeko-e-testnet` as unknown routes.
- `pnpm exec moon run faucet:test -f -- --run test/worker.test.ts` failed after updating expected claim chain IDs: valid claims using `zeko-m-devnet` were rejected as `invalid_chain`.

## GREEN Evidence

- `pnpm exec moon run bridge-ui:test -f -- --run test/unit/network-nomenclature.test.ts` passed.
- `pnpm exec moon run bridge-cli:test -f -- --run tests/routes.test.ts tests/sdk-config.test.ts` passed.
- `pnpm exec moon run faucet:test -f -- --run test/worker.test.ts` passed.
- `pnpm exec moon run bridge-ui:typecheck -f` passed.
- `pnpm exec moon run bridge-cli:test -f` passed.
- `pnpm exec moon run faucet:typecheck -f` passed.
- `pnpm exec moon run faucet-cli:check -f` passed.
- `pnpm exec moon run faucet-cli:test -f` passed.
- `pnpm exec moon run bridge-ui:test -f` passed.
- `pnpm exec moon run bridge-validator:test -f` passed.
- `pnpm exec moon run bridge-validator:typecheck -f` passed.
- `pnpm exec moon run faucet-ui:typecheck -f` passed.
- `pnpm exec moon run zeko-skills:test -f` passed.
- `pnpm exec moon run docs:test -f` passed.
- Commit hooks ran `pnpm exec moon run :lint-fix`, `pnpm exec moon run :format-all-fix`, and `pnpm exec moon run bridge-ui:typecheck`. Lint produced existing warnings in unrelated projects but completed successfully.
