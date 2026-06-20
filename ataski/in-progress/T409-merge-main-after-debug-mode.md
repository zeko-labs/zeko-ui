---
id: T409
title: "Merge main after debug mode"
status: in-progress
blockedBy: []
owner: Codex
created_at: 2026-06-20T07:19:18Z
updated_at: 2026-06-20T07:20:00Z
---

## Requirements

- Merge current `origin/main` into PR #220 so the branch is mergeable.
- Preserve the `main` bridge-ui debug-mode changes as source of truth where they overlap with this branch.
- Preserve the bridge finality, CLI diagnostics, wallet env, dashboard, and validator changes already in #220.
- Resolve Ataski/task-board conflicts without renumbering existing tasks.

## Test Plan

- Test Strategy Exception: this is a merge-conflict resolution task. Validate by completing the merge, checking conflict-free status, and running targeted affected project validation plus `git diff --check`.

## RED Evidence

- GitHub reports PR #220 as `CONFLICTING` against `main`.

## GREEN Evidence
