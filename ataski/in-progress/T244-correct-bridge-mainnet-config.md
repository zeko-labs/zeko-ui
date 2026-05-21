---
id: T244
title: "correct-bridge-mainnet-config"
status: in-progress
blockedBy: [T243]
owner: codex
created_at: 2026-05-21T07:51:03Z
updated_at: 2026-05-21T08:00:34Z
---

## Requirements

- Apply the minimal code/config/docs correction from the T243 audit.
- Do not enable `mina:mainnet <=> zeko:mainnet` as a working CLI route unless the Actions API/indexer dependency is proven mainnet-ready.
- If the route is not ready, keep it disabled and make the disabled reason specific enough for operators.
- Ensure SDK/example configuration can still express mainnet endpoints and network IDs without implying the full bridge route is operational.
- Preserve testnet defaults and existing testnet behavior.
- Add regression tests for the chosen route behavior and any SDK/example config fixes.
- Add a changeset only for publishable package behavior/doc changes.

## Test Plan

- TDD. First add/update tests that fail against the current code for the chosen correction, including explicit Actions API/mainnet route readiness behavior.
- GREEN should run focused bridge-cli and bridge-sdk tests, typechecks, and linters through Moon.
- Do not run manual live tests or transaction-submitting commands.

## RED Evidence

- Pending. The first implementation step is to add route/config regression tests that fail against current `origin/main` behavior:
  - disabled mainnet routes should expose an explicit Actions API/indexer readiness reason instead of the generic `Known route, not enabled yet.`
  - bridge-sdk examples should accept `L1_NETWORK=mainnet` / `L2_NETWORK=mainnet` and reject invalid network IDs.
  - `Bridge.setL2()` should pass `config.zekoArchiveUrl` as the o1js archive endpoint.

## GREEN Evidence
