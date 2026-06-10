---
id: T301
title: "align-ops-dashboard-testnet-archive"
status: done
blockedBy: [T300]
owner: codex
created_at: 2026-06-10T12:55:43Z
updated_at: 2026-06-10T12:55:43Z
---

## Requirements

- Align the ops dashboard testnet L1 archive default with the deployed actions indexer runtime configuration.
- Keep the local and Worker defaults consistent so testnet status does not depend on a local-only environment override.

## Test Plan

- DDD: verify the token-enabled local dashboard reports the runtime testnet L1 archive endpoint and both networks return authenticated indexer status.
- Run the focused dashboard tests after updating the default.

## RED Evidence

- Northflank runtime for `actions-indexer-testnet-deployment` uses `L1_ARCHIVE_URL=https://gateway.mina.archive.devnet.zeko.io`.
- The dashboard code and Wrangler vars still defaulted `TESTNET_L1_ARCHIVE_URL` to `https://api.minascan.io/archive/devnet/v1/graphql`, which timed out during local probes.

## GREEN Evidence

- Updated dashboard defaults, `.env.example`, and Wrangler vars to use `https://gateway.mina.archive.devnet.zeko.io`.
- `curl -fsS 'http://localhost:3092/api/ops/status?network=testnet'` returned `summary: 5 ok / 0 warn / 0 error` with `l1ArchiveUrl: https://gateway.mina.archive.devnet.zeko.io`.
