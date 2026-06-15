---
id: T347
title: "Fix actions dashboard same-zone fetch"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-15T16:13:22Z
updated_at: 2026-06-15T16:22:30Z
---

## Requirements

- The actions dashboard Worker must fetch the Zeko action-indexer through the public `.zeko.io` URLs for both status probes and control actions.
- Remove the Northflank origin override path from runtime configuration, docs, and examples.
- Configure the Worker so same-zone `.zeko.io` subrequests behave like public Internet requests instead of routing through the zone origin path.
- Verify with a temporary deployed diagnostic Worker that a same-zone custom-domain Worker can fetch `https://indexer.actions.zeko.io/health` and `https://testnet.indexer.actions.zeko.io/health` successfully through their public hostnames.
- Redeploy the dashboard after the fix and clean up any temporary Cloudflare resources used for diagnostics.

## Test Plan

- TDD: first update the unit tests so request-scoped origin override env values cannot change the actions-indexer request URL and the Wrangler config must include the same-zone public fetch compatibility flag.

## RED Evidence

- `moon run -f actions-dashboard:test` failed as expected: Wrangler config did not contain `global_fetch_strictly_public`, and action-indexer request routing still allowed an obsolete origin override instead of using the public `.zeko.io` endpoint.

## GREEN Evidence

- Deployed temporary same-zone custom-domain Worker `codex-actions-same-zone-debug` with `global_fetch_strictly_public`; its probes to `https://indexer.actions.zeko.io/health` and `https://testnet.indexer.actions.zeko.io/health` both returned HTTP 200 with no redirect.
- `moon run -f actions-dashboard:test`: passed, 27 tests.
- `moon run -f actions-dashboard:typecheck`: passed.
- `moon run -f actions-dashboard:lint`: passed.
- `moon run -f actions-dashboard:build`: passed.
- `moon run -f actions-dashboard:deploy`: passed, deployed `actions-dashboard` version `e6573bb4-1a59-4cee-8ed8-15888cb11074`.
- Deployed Worker binding output shows only `MAINNET_ACTIONS_INDEXER_URL=https://indexer.actions.zeko.io` and `TESTNET_ACTIONS_INDEXER_URL=https://testnet.indexer.actions.zeko.io` for indexer endpoints.
- Unauthenticated curl to `https://actions.dashboard.zeko.io/api/ops/status?network=mainnet` returned Cloudflare Access 302, confirming the private API is still behind Access.
- Repo scan found no stale hardcoded Northflank action-indexer origin URLs.
- Temporary diagnostic Worker was deleted after validation.
