---
id: T339
title: "Fix Codex review daemon query and control retry"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T17:38:10Z
updated_at: 2026-06-12T17:41:20Z
---

## Requirements

- Make daemon status GraphQL probes valid against Mina and Zeko daemon schemas by selecting scalar `daemonStatus` fields.
- Ensure non-idempotent indexer control POST requests are not retried after network, 429, or 5xx failures.
- Preserve existing retry behavior for read-only dashboard probes.

## Test Plan

- BDD: add tests that inspect daemon probe query shape and assert control POST requests are single-shot.
- RED path: prove the current daemon query lacks a `daemonStatus` selection set and control POSTs retry on 503.
- GREEN path: add a valid daemon selection and disable retries for control POSTs, then rerun ops dashboard tests, typecheck, lint, build, diff check, and Codex review.

## RED Evidence

- `moon run -f ops-dashboard:test` failed as expected:
  - `selects scalar daemonStatus fields in daemon health probes` showed the query still requested bare `daemonStatus`.
  - `does not retry non-idempotent indexer controls` observed three POST attempts for one reset request.

## GREEN Evidence

- `moon run -f ops-dashboard:test` passed: 25 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed.
- `git diff origin/main --check` passed.
