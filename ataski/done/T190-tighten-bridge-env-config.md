---
id: T190
title: "Tighten bridge env config"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T18:20:54Z
updated_at: 2026-05-08T18:23:13Z
---

## Requirements

- Remove unused SDK example `WALLET_ADDRESS` env configuration by making `diagnoseHistory` derive the wallet address from `MINA_PRIVATE_KEY`.
- Remove `BRIDGE_CLI_ACTIONS_API_URL` runtime override support so bridge CLI actions API selection comes only from static SDK config.
- Keep alphanet URLs as commented config-only alternatives, not runtime product behavior.
- Explain the `vue-xstate` selector reactivity change and whether it is justified.

## Test Plan

- DDD: inspect env/config call sites first, make the smallest static config changes, then run focused Moon validation.
- Validate bridge SDK examples through `bridge-sdk:typecheck`.
- Validate bridge CLI config through `bridge-cli:typecheck` and `bridge-cli:test`.

## RED Evidence

`WALLET_ADDRESS` is only used by `diagnoseHistory`, while the other SDK examples derive their recipient from `MINA_PRIVATE_KEY`. `createSdkConfig` still reads `BRIDGE_CLI_ACTIONS_API_URL` from runtime env and has a test for that override.

## GREEN Evidence

- `moon run bridge-sdk:typecheck bridge-cli:typecheck bridge-cli:test` passed. `bridge-sdk:typecheck` was cached in that combined run, so it was forced separately.
- `moon run -f bridge-sdk:typecheck` passed.
- `git diff --check` passed.
