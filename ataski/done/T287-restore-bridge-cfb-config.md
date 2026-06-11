---
id: T287
title: "Restore bridge CFB config"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T00:00:00+07:00
updated_at: 2026-06-11T00:00:00+07:00
---

## Requirements

- Investigate the failing Cloudflare Workers Builds check for the bridge UI PR branch.
- Restore the checked-in bridge Workers Builds trigger config to match the intended testnet Worker target.
- Keep the fix limited to source-of-truth repository config; do not call Cloudflare APIs directly.
- Validate the Nuxt app build matrix locally after the fix.

## Test Plan

- DDD: compare the branch config against `origin/main`, identify the remote check target, then patch the minimum config drift.
- Run local Moon validation for the affected bridge UI build and the Nuxt app build matrix.

## RED Evidence

- PR check reported `Workers Builds: bridge-testnet` failure.
- Branch `apps/bridge-ui/workers-build.jsonc` had regressed to `scriptName: "bridge"` and was missing the `origin/main` `bridge-testnet` trigger metadata, environment variables, pruning, and broader path includes.
- `moon run cloudflare-build-config:sync-dry-run -- apps/bridge-ui/workers-build.jsonc` is blocked locally because `CLOUDFLARE_API_TOKEN` is not available.

## GREEN Evidence

- Restored `apps/bridge-ui/workers-build.jsonc` to match the `origin/main` `bridge-testnet` Workers Builds source-of-truth config.
- Confirmed `git diff --exit-code origin/main -- apps/bridge-ui/workers-build.jsonc` passes.
- `moon run -f faucet-ui:build` passed.
- `moon run -f lb-ui:build` passed.
- `moon run -f bridge-ui:build` passed.
