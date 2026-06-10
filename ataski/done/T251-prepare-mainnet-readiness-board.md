---
id: T251
title: "Prepare mainnet readiness board"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-21T10:40:00Z
updated_at: 2026-05-21T10:48:00Z
---

## Requirements

- Clean the stale Ataski drift where `ataski/in-progress/T093-finalize-bridge-cli-release-and-validator-ops.md` exists while `ataski/tasks.md` records `T093` as done under a different task path.
- Keep `docs/BRIDGE_MAINNET_READINESS_PLAN.md` as the single implementation plan.
- Ensure implementation tasks are self-contained and ordered by dependency.
- Keep a written Implementation Review Log in `docs/BRIDGE_MAINNET_READINESS_PLAN.md` for any implementation action, decision, command choice, or file edit not explicitly specified by the plan.

## Test Plan

- DDD: inspect `git status`, `ataski/tasks.md`, and `find ataski/todo ataski/in-progress ataski/done` to verify the stale in-progress file is gone and the new tasks are discoverable.

## RED Evidence

Recorded on 2026-05-21:

- `git status --short --branch` showed stale tracked deletion needed for `ataski/in-progress/T093-finalize-bridge-cli-release-and-validator-ops.md` after cleanup began.
- `tail -n 12 ataski/tasks.md` showed new tasks `T251` through `T257` appended as `todo`.
- `find ataski/todo ataski/in-progress ataski/done -maxdepth 1 -type f -name 'T25*.md' | sort` showed `T251` through `T257` in `ataski/todo/`.

## GREEN Evidence

Recorded on 2026-05-21:

- `test ! -e ataski/in-progress/T093-finalize-bridge-cli-release-and-validator-ops.md && echo stale-t093-removed` returned `stale-t093-removed`.
- `find ataski/todo ataski/in-progress ataski/done -maxdepth 1 -type f -name 'T25*.md' | sort` showed `T251` in progress and `T252` through `T257` in todo before completion.
- `tail -n 12 ataski/tasks.md` showed `T251` through `T257` in ascending order with dependencies represented by task files.
