---
id: T213
title: "Set bridge-sdk example network IDs for zeko-mainnet"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-19T13:10:00Z
updated_at: 2026-05-19T13:14:00Z
---
## Requirements

- Update `packages/bridge-sdk/examples/helper.ts` network fields exactly as requested:
  - `l1Network: "mainnet"`
  - `l2Network: { custom: "zeko-mainnet" }`
- Keep the change scoped to examples helper config only.

## Test Plan

- BDD
  - RED: verify existing helper uses testnet network ids.
  - GREEN: run one bridge-sdk example command after update to confirm runtime still initializes with the new network ids.

## RED Evidence

- Confirmed existing helper had testnet network IDs:
  - `l1Network: "testnet"`
  - `l2Network: "testnet"`

## GREEN Evidence

- Updated `packages/bridge-sdk/examples/helper.ts` to:
  - `l1Network: "mainnet"`
  - `l2Network: { custom: "zeko-mainnet" }`
- Validation command:
  - `nix develop -c env MINA_PRIVATE_KEY=... L1_URL=https://api.minascan.io/node/mainnet/v1/graphql L1_ARCHIVE_URL=https://archive-node-api.gcp.o1test.net L2_URL=https://mainnet.zeko.io/graphql L2_ARCHIVE_URL=https://archive.mainnet.zeko.io/graphql ACTIONS_API_URL=http://127.0.0.1:9100/graphql pnpm exec moon run bridge-sdk:fetchOuterActions -f`
- Result: command succeeded and returned 2 deposits, confirming runtime initialization with updated network IDs.
