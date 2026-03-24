---
id: T130
title: "Merge main and resolve PR 144 conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-03-24T11:56:36Z
updated_at: 2026-03-24T11:56:36Z
---

## Requirements

- Reproduce the current merge conflicts between `branch/use-zeko-skill-public-mirror` and `origin/main`.
- Merge `origin/main` into the current feature branch and resolve every conflict locally.
- Preserve the intended `use-zeko` skill behavior and the already-fixed review findings while incorporating upstream changes from `main`.
- Re-run the relevant `use-zeko` package verification after conflict resolution.

## Test Plan

- DDD. First reproduce the conflict set with a local merge against `origin/main`, then resolve each conflicted file and rerun the relevant package tests/checks from the repo root.

## RED Evidence

## GREEN Evidence
