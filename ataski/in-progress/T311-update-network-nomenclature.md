---
id: T311
title: "Update network nomenclature"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-12T08:51:04Z
updated_at: 2026-06-12T08:52:30Z
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

## GREEN Evidence
