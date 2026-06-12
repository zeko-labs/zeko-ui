---
id: T322
title: "Fix dashboard data path"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T15:48:13Z
updated_at: 2026-06-10T15:58:37Z
---

## Requirements

- Ensure deployed `ops.zeko.io` server API reads Cloudflare Worker bindings/secrets for both network endpoint config and indexer bearer tokens.
- Keep indexer tokens private to the server API; the browser UI must never call private indexer `/status` or control endpoints directly.
- Preserve local development support through `process.env`.
- Make indexer probe errors explicit when an endpoint returns a redirect or HTML instead of JSON.
- Verify testnet and mainnet indexer data can be rendered from the unified dashboard API path.

## Test Plan

- BDD: first add failing coverage for Cloudflare-binding env resolution and bearer-token propagation from `createOpsSnapshot`/`runIndexerControl`; then update the server utility and API handlers to pass request-scoped bindings into the probe layer.

## RED Evidence

- The deployed Worker has `MAINNET_ACTIONS_INDEXER_TOKEN` and `TESTNET_ACTIONS_INDEXER_TOKEN` secrets configured.
- Direct unauthenticated `/status` calls to both indexers return `401 {"success":false,"message":"Unauthorized"}`, so the dashboard must send the bearer token from its server API.
- Current server utility reads only `process.env`, which is unreliable for Cloudflare Worker bindings/secrets in Nitro request handlers.
- `moon run ops-dashboard:test` fails the new acceptance tests because request-scoped env overrides are ignored, `readActionsIndexerToken("testnet", env)` returns `undefined`, and `runIndexerControl("reset", "testnet", env)` reports the token as missing.

## GREEN Evidence

- Added acceptance tests for request-scoped Cloudflare Worker binding resolution and indexer bearer-token propagation.
- Updated `getOpsConfig`, `readActionsIndexerToken`, `createOpsSnapshot`, and `runIndexerControl` to accept an `OpsEnv` object with `process.env` as local fallback.
- Updated `/api/ops/status` and `/api/ops/control` handlers to pass `event.context.cloudflare.env` into the ops utility layer.
- Sent the indexer bearer token to `/health`, `/status`, and control endpoints from the server API only.
- Changed probe fetches to `redirect: "manual"` so Access/login redirects surface as HTTP redirect responses instead of redirect-loop errors.
- Verified deployed Worker secret names: `MAINNET_ACTIONS_INDEXER_TOKEN` and `TESTNET_ACTIONS_INDEXER_TOKEN`.
- Deployed Worker version `a9598dd7-2762-4268-bc57-489fbd149fad` to `ops.zeko.io`.

## Validation

- `moon run ops-dashboard:test`
- `moon run ops-dashboard:lint`
- `moon run ops-dashboard:typecheck`
- `moon run ops-dashboard:deploy`

## Verification Limits

- Plain curl cannot access `https://ops.zeko.io/api/ops/status` because the API is correctly protected by Cloudflare Access.
- Temporary service-token verification was blocked because `CFZT_TOKEN` lacks `Access: Service Tokens Write`.
- `wrangler dev --remote` verification was blocked because `cloudflared` is not installed locally.
