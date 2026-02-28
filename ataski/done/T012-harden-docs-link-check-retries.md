---
id: T012
title: "Harden docs link check retries"
status: done
blockedBy: []
owner: codex
created_at: 2026-02-28T08:48:56Z
updated_at: 2026-02-28T08:56:37Z
---

Fix the docs external link checker so transient bot blocks and fetch failures do not fail CI immediately.

## RED Evidence

- `moon docs:test -u` failed in the dedicated worktree after adding retry-focused unit tests
- `tests/check-links.test.ts > checkUrl > retries transient server failures` returned `503` instead of retrying to `200`
- `tests/check-links.test.ts > checkUrl > retries bot-blocked responses after a GET fallback` returned `403` instead of retrying to `200`

## GREEN Evidence

- `moon docs:test -u` passed in `/Users/hebilicious/GitHub/zeko-ui/ataski/worktrees/T012-docs-link-check-retries`
- `CI=true moon docs:test -u` passed in `/Users/hebilicious/GitHub/zeko-ui/ataski/worktrees/T012-docs-link-check-retries`
