---
id: T332
title: "Clarify indexer reset controls"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T10:44:31Z
updated_at: 2026-06-12T10:48:34Z
---

## Requirements

- Keep dashboard control names aligned with the actual actions-indexer API and CLI names.
- The destructive control button must be labeled `Reset`, not `Resync`.
- Explain why both `Rebuild` and `Reset` exist:
  - `Rebuild` repopulates indexed rows from archives and resumes from rebuilt heads; use it when archive data is trusted but indexed rows are incomplete or wrong.
  - `Reset` clears indexed state and starts from scratch; use it when the stored indexer state, cursors, or derived data cannot be trusted.
- Avoid using `resync` as the primary operation name because the backend operation is `reset`.

## Test Plan

- BDD: add a dashboard copy test that fails while the page still lacks a canonical `Reset` label and explicit rebuild/reset guidance.
- GREEN validation with `moon run -f ops-dashboard:test`, `moon run -f ops-dashboard:typecheck`, `moon run -f ops-dashboard:lint`, and `moon run -f ops-dashboard:build`.

## RED Evidence

- `moon run -f ops-dashboard:test` failed because `../app/utils/indexer-control-copy` does not exist yet; this captures the missing canonical control labels and rebuild/reset guidance before implementation.

## GREEN Evidence

- Added `indexerControlCopy` so the dashboard has canonical copy for `Rebuild` and `Reset`.
- The reset control button now displays `Reset` while still calling `runControl("reset")`; no `Resync`/`resync` strings remain under `apps/ops-dashboard`.
- The control note now explains when to use `Rebuild`, when to use `Reset`, and why both operations exist.
- `moon run -f ops-dashboard:test` passed: 15 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed as part of deploy.
- `moon run -f ops-dashboard:deploy` passed and deployed `ops-dashboard` version `3ede86be-6095-444e-817c-ffcac8d33eb2` to `ops.zeko.io`.
- `curl -I https://ops.zeko.io` and `curl -I 'https://ops.zeko.io/api/ops/status?network=mainnet'` both returned Cloudflare Access `302` redirects.
