---
id: T032
title: "codify cloudflare workers build config"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-04T13:29:22Z
updated_at: 2026-03-04T13:50:49Z
---

Add per-project Workers Build config files and a private package that syncs Cloudflare trigger settings from those files.

## TDD Exception

This task adds configuration files and a Cloudflare sync utility for external trigger state. Red/green TDD is not a good fit because the primary validation is schema parsing plus live Cloudflare API synchronization against existing triggers.

## GREEN

- `node --check packages/cloudflare-build-config/src/cli.mjs`
- `CLOUDFLARE_API_TOKEN=... node packages/cloudflare-build-config/src/cli.mjs --dry-run`
- `CLOUDFLARE_API_TOKEN=... node packages/cloudflare-build-config/src/cli.mjs`
- `CLOUDFLARE_API_TOKEN=... node packages/cloudflare-build-config/src/cli.mjs --dry-run`

Validation summary:

- Added `workers-build.jsonc` files next to every `wrangler.jsonc`, with `unused/ui` explicitly marked disabled because no deployed Worker exists.
- Synced all active Workers Build triggers from those config files, including corrected deploy commands and docs watch paths.
- Confirmed the latest manual Cloudflare builds for `faucet` and `zeko-docs` both completed successfully.
