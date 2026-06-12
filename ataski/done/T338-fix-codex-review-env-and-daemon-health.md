---
id: T338
title: "Fix Codex review env and daemon health"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T17:28:29Z
updated_at: 2026-06-12T17:31:00Z
---

## Requirements

- Downgrade L1 daemon status when the best-chain head probe fails or returns no block height.
- Let ops API routes run in local dev and preview by merging `process.env` with Cloudflare env bindings, with Cloudflare bindings taking precedence.
- Preserve production behavior and existing network/control semantics.

## Test Plan

- BDD: add failing tests for daemon-head probe failure and route env merging before implementation.
- RED path: prove the daemon remains `ok` on missing head data and route env merging helper does not exist yet.
- GREEN path: implement the shared env helper and daemon status downgrade, then rerun ops dashboard tests, typecheck, lint, build, diff check, and Codex review.

## RED Evidence

- `moon run -f ops-dashboard:test` failed as expected before implementation:
  - `resolveRouteEnv` was not implemented.
  - L1 daemon status stayed `ok` when the best-chain head probe returned a GraphQL error.

## GREEN Evidence

- `moon run -f ops-dashboard:test` passed: 23 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed.
- `git diff origin/main --check` passed.
