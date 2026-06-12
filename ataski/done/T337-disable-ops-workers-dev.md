---
id: T337
title: "Disable ops dashboard workers.dev exposure"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T17:14:36Z
updated_at: 2026-06-12T17:16:00Z
---

## Requirements

- Disable the default `workers.dev` hostname for the ops dashboard Worker so the dashboard and control API are only exposed through the Cloudflare Access-protected `ops.zeko.io` route.
- Keep version preview URLs disabled.
- Add a regression test that distinguishes `workers_dev` from `preview_urls`.

## Test Plan

- BDD: assert the Cloudflare Worker config explicitly disables both `workers_dev` and version preview URLs before changing the config.
- RED path: `moon run -f ops-dashboard:test` must fail because `workers_dev: false` is missing.
- GREEN path: add the config guard, then rerun ops dashboard tests, typecheck, lint, build, and Codex review.

## RED Evidence

- `moon run -f ops-dashboard:test` failed as expected before implementation because `wrangler.jsonc` did not contain `"workers_dev": false`.

## GREEN Evidence

- `moon run -f ops-dashboard:test` passed: 21 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed.
- `git diff origin/main --check` passed.
