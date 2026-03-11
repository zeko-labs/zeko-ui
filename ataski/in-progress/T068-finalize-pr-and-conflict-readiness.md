---
id: T068
title: "Finalize PR and conflict readiness"
status: in-progress
blockedBy: [T066, T067]
owner: codex
created_at: 2026-03-11T10:21:57Z
updated_at: 2026-03-11T10:28:33Z
---

## Requirements

- Sync this branch with the latest `origin/main` before PR creation.
- Resolve any resulting conflicts in Ataski files, vendored skill files, and `AGENTS.md`.
- Re-run the repo-side verification after conflict resolution.
- Commit the branch with conventional commit messages and create a PR that is ready to merge after review.

## Test Plan

- Verify the branch is clean except for the intended tracked changes before push.
- Confirm the branch is up to date with `origin/main` at PR creation time.
- Ensure the PR opens against `main` without conflict warnings.

## RED Evidence

## GREEN Evidence
