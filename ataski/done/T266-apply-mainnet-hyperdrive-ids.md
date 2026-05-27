---
id: T266
title: "Apply mainnet Hyperdrive IDs"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-27T02:33:00Z
updated_at: 2026-05-27T02:35:00Z
---

## Requirements

- Replace the reviewed mainnet Hyperdrive placeholder IDs in `services/actions/api/wrangler.jsonc`.
- Use the newly created Cloudflare Hyperdrive configs:
  - cached `actions-mainnet-db-cache`: `9d11060dc2af499d897f52c8d3a7c74f`
  - no-cache `actions-mainnet-db-no-cache`: `e674c005e43c4d45ac622e987294c51d`
- Regenerate or validate Cloudflare worker configuration as required by the repo workflow.
- Keep local generated secrets in ignored env files only.

## Test Plan

- DDD: this is a deployment configuration value replacement driven by provisioned Cloudflare resources.
- RED path: verify the placeholders are still present before editing.
- GREEN path: verify placeholders are gone, run relevant Actions API type/config validation, and record command results.

## RED Evidence

- `rg -n "__MAINNET_REVIEW_REQUIRED_HYPERDRIVE|hyperdrive|HYPERDRIVE" services/actions/api/wrangler.jsonc` showed both mainnet placeholder IDs before editing.

## GREEN Evidence

- Replaced the mainnet no-cache Hyperdrive ID with `e674c005e43c4d45ac622e987294c51d`.
- Replaced the mainnet cached Hyperdrive ID with `9d11060dc2af499d897f52c8d3a7c74f`.
- `rg -n "__MAINNET_REVIEW_REQUIRED_HYPERDRIVE" services/actions/api/wrangler.jsonc` returned no matches.
- `moon run actions-api:type-cf -f` passed.
- `moon run actions-api:typecheck -f` passed.
- `moon run actions-api:lint -f` passed.
