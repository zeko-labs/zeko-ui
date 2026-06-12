---
id: T335
title: "Ignore stale refresh errors"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T16:35:12Z
updated_at: 2026-06-12T16:53:49Z
---

## Requirements

- Fix Codex review P2: stale failed refresh requests must not overwrite the dashboard error state after a newer refresh or network switch succeeds.
- Keep the existing graceful state transition behavior: do not clear visible data while loading the next snapshot.
- Fix `git diff --check` whitespace issues in the dashboard template.
- Rerun focused dashboard validation and Codex review.

## Test Plan

- DDD: inspect the refresh sequence/network guard, apply the same guard to error writes, verify with `git diff --check`, focused Moon validation, and Codex review.

## RED Evidence

- `.agents/skills/codex-review/scripts/codex-review --mode branch` reported `[P2] Ignore stale refresh failures`.
- `git diff ... --check` reported mixed space/tab indentation in `apps/ops-dashboard/app/pages/index.vue`.

## GREEN Evidence

- `refresh()` now uses a shared sequence/network guard before writing either `snapshot` or `errorMessage`.
- Fixed mixed space/tab indentation reported by `git diff --check`.
- `git diff origin/main --check` passed.
- `moon run -f ops-dashboard:test` passed.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed.
