---
id: T322
title: "Align Nuxt Cloudflare env"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T16:53:03Z
updated_at: 2026-06-10T17:38:28Z
---

## Requirements

- Use the same Nuxt Cloudflare env access pattern as existing repo apps.
- Remove the custom env resolver and read `event.context.cloudflare.env` directly in server API routes.
- Fail with a clear server error if the Cloudflare env context is missing.
- Validate the deployed Access-protected API directly without requiring user refresh feedback.

## Test Plan

- BDD: update tests to cover the direct Nuxt route context shape and missing-context failure, run the dashboard suite, deploy, then validate live by temporarily adding an IP-scoped Access bypass policy and deleting it after API checks.

## RED Evidence

- Existing repo examples use `event.context.cloudflare.env` directly:
  - `apps/faucet-ui/server/api/faucet.post.ts`
  - `apps/faucet-ui/server/api/healthcheck.get.ts`
  - `apps/bridge-ui/server/routes/metrics.ts`
- The ops dashboard currently carries a custom resolver that diverges from the established Nuxt app pattern.

## GREEN Evidence

- Removed the custom Nuxt Cloudflare env resolver and aligned the ops API routes with the repo pattern: `event.context.cloudflare.env`.
- Added an Access-protected `/api/ops/indexer-token` endpoint so the deployed UI can call the action-indexer directly from the browser with the network-specific Worker secret.
- Changed the UI refresh path to hydrate the action-indexer service record from direct browser health/status calls, while keeping archive/daemon aggregation on the private dashboard API.
- Changed indexer controls to call the action-indexer directly from the authenticated UI using the private token endpoint.
- Confirmed Cloudflare Worker server-side fetches to the same-zone indexer host still redirect-loop from the edge, so the unused `resolveOverride` experiment was removed and the temporary DNS aliases were deleted.
- Deployed final Worker version `5be7d8fc-91a5-4985-bb2b-e357554fc2ee`.
- Final deployed validation with a temporary IP-scoped Access bypass:
  - testnet token endpoint returned a token; direct health HTTP 200 reported `service=testnet`, `db=up`, `indexer=running`, `errors=0`, `lastFetched L1=526820`, `lastFetched L2=1095337`; direct status HTTP 200 reported `running=true`, `interval=15`.
  - mainnet token endpoint returned a token; direct health HTTP 200 reported `service=mainnet`, `db=up`, `indexer=running`, `errors=0`, `lastFetched L1=527826`, `lastFetched L2=84`; direct status HTTP 200 reported `running=true`, `interval=15`.
  - The temporary Access bypass policy was deleted after validation.

## Validation

- `pnpm exec dprint fmt apps/ops-dashboard/app/pages/index.vue apps/ops-dashboard/server/utils/ops.ts apps/ops-dashboard/test/ops.test.ts apps/ops-dashboard/wrangler.jsonc apps/ops-dashboard/.env.example apps/ops-dashboard/README.md apps/ops-dashboard/server/api/ops/indexer-token.get.ts`
- `moon run ops-dashboard:typecheck`
- `moon run ops-dashboard:lint`
- `moon run ops-dashboard:test`
- `moon run ops-dashboard:deploy`
