---
id: T336
title: "Fix Codex review control safety"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T17:04:49Z
updated_at: 2026-06-12T17:07:25Z
---

## Requirements

- Disable public preview URLs for the ops dashboard Worker so operational control routes are only exposed through the Access-protected production hostname.
- Reject malformed or missing `network` values on `/api/ops/control` instead of allowing `resolveOpsNetwork` to fall back to mainnet.
- Display database status age from the indexer database health detail, not canonical progress age.
- Preserve existing network selection, token handling, and rebuild/reset behavior.

## Test Plan

- BDD: add tests for the control API contract and dashboard data helpers before implementing the fix.
- RED path: prove invalid control networks are currently accepted as mainnet and the DB age helper currently reads canonical age.
- GREEN path: make the tests pass, then run the ops dashboard test, typecheck, lint, build, and Codex review command.

## RED Evidence

- `moon run -f ops-dashboard:test` failed as expected before implementation:
  - `wrangler.jsonc` still contained `"preview_urls": true`.
  - `resolveControlNetwork` was not implemented.
  - `databaseAgeSeconds` was not implemented.

## GREEN Evidence

- `moon run -f ops-dashboard:test` passed: 21 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed.
- `git diff origin/main --check` passed.
