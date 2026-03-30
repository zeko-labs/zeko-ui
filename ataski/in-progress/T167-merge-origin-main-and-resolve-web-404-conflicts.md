---
id: T167
title: "Merge origin/main and resolve WEB-404 conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-03-30T17:35:11Z
updated_at: 2026-03-30T17:35:11Z
---

## Requirements

- Fetch the latest `origin/main` into the canonical WEB-404 worktree and merge it into `branch/web-404-cancellation-queue`.
- Resolve any conflicts without regressing the intended WEB-404 bridge-ui queue behavior.
- Keep the PR scoped to the bridge-ui cancellation UX branch; do not reintroduce extracted SDK or CLI-only fixes unless the merge requires the branch's existing bridge-ui behavior to remain correct.
- Re-run the bridge-ui validation suite after conflict resolution.

## Test Plan

- TDD
- Use the merge conflicts and any first failing bridge-ui check after the merge as RED evidence, then resolve until the bridge-ui checks pass again.

## RED Evidence

## GREEN Evidence
