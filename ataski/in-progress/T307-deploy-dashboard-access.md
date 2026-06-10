---
id: T307
title: "Deploy dashboard behind Cloudflare Access"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-10T14:20:00Z
updated_at: 2026-06-10T14:20:00Z
---

## Requirements

- Deploy the ops dashboard to Cloudflare Workers static assets.
- Protect the dashboard hostname with Cloudflare Access before exposing it publicly.
- Prefer GitHub org-gated Access for the Zeko GitHub organization when a suitable GitHub identity provider is available.
- Keep a detailed operational log without recording secret token values.

## Test Plan

- DDD: inspect Cloudflare/Wrangler/GitHub access, create or update Access resources through API if permitted, deploy through the repo Moon/Wrangler task, then verify the hostname responds with Access protection.

## RED Evidence

- The dashboard is implemented locally but has not yet been deployed and verified behind Cloudflare Access.

## Operational Log

- 2026-06-10T14:20:00Z: Confirmed `apps/ops-dashboard/wrangler.jsonc` targets Worker `ops-dashboard` with static assets and custom domain `ops.zeko.io`.
- 2026-06-10T14:20:00Z: Confirmed GitHub CLI is authenticated as `Hebilicious` with `read:org` and `repo` scopes.
- 2026-06-10T14:20:00Z: Root-level `pnpm exec wrangler` does not resolve; app-local `pnpm --dir apps/ops-dashboard exec wrangler` resolves Wrangler 4.77.0.
- 2026-06-10T14:20:00Z: App-local Wrangler is authenticated through Cloudflare OAuth for the `Zeko` account. Token values were not printed.
- 2026-06-10T14:20:00Z: Current Wrangler OAuth scopes include Workers write and zone read; Access/Zero Trust write capability still needs verification through API.
- 2026-06-10T14:23:00Z: Confirmed `gh` can see `zeko-labs` and the authenticated GitHub user is an active org admin.
- 2026-06-10T14:23:00Z: Confirmed Worker secrets `MAINNET_ACTIONS_INDEXER_TOKEN` and `TESTNET_ACTIONS_INDEXER_TOKEN` already exist for `ops-dashboard`.
- 2026-06-10T14:24:00Z: Confirmed `ops.zeko.io` currently does not resolve, so the custom domain is not currently publicly reachable.
- 2026-06-10T14:24:00Z: Confirmed existing `ops-dashboard` Worker deployments exist, created by upload and secret changes.
- 2026-06-10T14:26:00Z: Added `ops-dashboard:configure-access`, a TypeScript automation task that finds an existing GitHub Access IdP, creates/updates the Access app for `ops.zeko.io`, and creates/updates an allow policy for GitHub organization `zeko-labs`.
- 2026-06-10T14:27:00Z: `moon run ops-dashboard:configure-access` fails safely without `CLOUDFLARE_API_TOKEN`.
- 2026-06-10T14:28:00Z: Running `ops-dashboard:configure-access` with the current Wrangler OAuth token reaches Cloudflare but fails on `GET identity_providers` with `403 Authentication error`; the current token cannot manage/read Access.
- 2026-06-10T14:28:00Z: Did not run `ops-dashboard:deploy`, because deploying the `ops.zeko.io` custom domain before Access is configured would risk exposing the dashboard.

## Blocker

- Need a Cloudflare API token scoped to the Zeko account with `Access: Apps and Policies Edit` and `Access: Identity Providers Read`. The current Wrangler OAuth token only has Workers/zone-oriented scopes and receives `403 Authentication error` from the Access API.

## GREEN Evidence

- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:build` passed. Build emitted only existing Browserslist/baseline data age warnings.
