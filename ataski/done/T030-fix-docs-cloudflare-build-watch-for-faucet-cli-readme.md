---
id: T030
title: "Fix docs Cloudflare build watch for faucet-cli README"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-04T12:30:41Z
updated_at: 2026-03-04T13:36:18Z
---

Update the remote docs deployment trigger so changes to
`packages/faucet-cli/README.md` cause a Cloudflare-hosted docs rebuild.

## TDD Exception

This task changes external Cloudflare build trigger configuration. There is no
local red test for the remote watch-path rules themselves.
Validation will use Cloudflare build API responses plus live docs checks.

## GREEN

- Workers Build watch paths for `zeko-docs` now include `apps/docs/**` and `packages/faucet-cli/README.md`.
- Manual Cloudflare docs build triggered after the trigger sync.
- Latest build `fe3abab4-a680-442b-b601-e132411116d9` completed with `build_outcome: success`.
- `https://docs.zeko.io/developers/tools/faucet-cli.html` now serves the Faucet CLI page with the expected VitePress module chunk and title.
