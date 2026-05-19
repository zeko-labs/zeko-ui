---
id: T236
title: "Merge new main tip into WEB-404"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T21:23:57Z
updated_at: 2026-05-08T21:26:10Z
---

## Requirements

- Merge the latest `origin/main` tip `c51b7d8` into `branch/web-404-cancellation-queue` after the first merge completed against `39948b6`.
- Preserve WEB-404 cancellation queue behavior and the bridge UI validation fixes from T195.
- Validate the bridge UI and push the updated PR branch.

## Test Plan

- DDD
- Use `moon run bridge-ui:typecheck -f` and `moon run bridge-ui:test -f` as the merge validation gate.

## RED Evidence

- After pushing the first merge, `git fetch origin main` advanced `origin/main` from `39948b6` to `c51b7d8`; `git merge-base --is-ancestor origin/main HEAD` returned non-zero.
- `git merge origin/main` conflicted only in `ataski/tasks.md` because main introduced T193/T194 while this branch had local T193/T194 bookkeeping.

## GREEN Evidence

- Preserved main's T193/T194 tasks and renumbered this branch's bookkeeping tasks to T195/T196.
- Merged `origin/main@c51b7d8`, including the devnet proxy endpoint updates.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:test -f` passed: 17 files, 94 tests.
