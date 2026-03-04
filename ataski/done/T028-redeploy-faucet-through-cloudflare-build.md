---
id: T028
title: "Redeploy faucet through Cloudflare build"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-04T12:30:41Z
updated_at: 2026-03-04T13:36:18Z
---

Restore the production faucet deployment by triggering a remote Cloudflare build so
the latest `apps/faucet/wrangler.jsonc` configuration is applied.

## TDD Exception

This task changes external Cloudflare build and deployment state. There is no
stable local red test that can model the remote build trigger itself.
Validation will use Cloudflare build API responses plus live endpoint checks.

## GREEN

- Manual Cloudflare build triggered for the production faucet deploy trigger.
- Latest build `2c015cc2-35be-47f0-a9ba-7d60352fa0e3` completed with `build_outcome: success`.
- `POST https://api.faucet.zeko.io/claim` now returns an application-level `403 github_verification_failed` response instead of a transport failure.
