---
id: T333
title: "Keep indexer token server side"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T14:17:53Z
updated_at: 2026-06-12T14:37:15Z
---

## Requirements

- Fix Codex review P1: the dashboard must not return the actions-indexer bearer token to the browser.
- Remove the `/api/ops/indexer-token` endpoint.
- Keep status and control calls server-side through Worker API routes that read the token from Cloudflare env bindings.
- Preserve dashboard refresh and control behavior from the user's perspective.
- Rerun focused dashboard validation and rerun Codex review until the accepted finding is gone.

## Test Plan

- BDD: add/adjust tests so no server endpoint returns the raw indexer token and server-side status/control still attach the token to upstream indexer calls.
- GREEN validation with `moon run -f ops-dashboard:test`, `moon run -f ops-dashboard:typecheck`, `moon run -f ops-dashboard:lint`, `moon run -f ops-dashboard:build`, and Codex review rerun.

## RED Evidence

- `.agents/skills/codex-review/scripts/codex-review --mode branch` reported `[P1] Keep indexer bearer tokens server-side` for `apps/ops-dashboard/server/api/ops/indexer-token.get.ts:23`.

## GREEN Evidence

- Removed `apps/ops-dashboard/server/api/ops/indexer-token.get.ts`.
- Removed browser-side indexer token hydration and direct browser calls to the actions-indexer; dashboard refresh now uses `/api/ops/status` and controls use `/api/ops/control`.
- Added a regression test that asserts the token endpoint file is absent.
- `rg -n "indexer-token|indexerToken|fetchIndexerJson|hydrateIndexerFromBrowser|directIndexerDetails" apps/ops-dashboard/app apps/ops-dashboard/server -g '!node_modules' -g '!.output' -g '!.nuxt'` returned no matches.
- `moon run -f ops-dashboard:test` passed.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed; generated routes include `action-coverage`, `control`, and `status`, with no `indexer-token` route.
