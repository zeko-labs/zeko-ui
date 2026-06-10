---
id: T315
title: "Merge main and check Linear instructions"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-10T21:44:49Z
updated_at: 2026-06-10T21:44:49Z
---

## Requirements

- Merge latest `origin/main` into `branch/actions-ops-dashboard`.
- Resolve conflicts if any without reverting dashboard work.
- Re-check merged repository instructions for Linear-specific guidance.
- Validate the ops dashboard after the merge and push the branch.

## Test Plan

- DDD: merge first, inspect any conflicts and resulting instructions, then run the ops dashboard test/typecheck/lint suite before pushing.

## RED Evidence

- Before the merge, `origin/main...HEAD` showed `origin/main` ahead by 10 commits and the PR branch ahead by 16 commits.
- Pre-merge `AGENTS.md` search found no Linear-specific team mapping or Linear issue creation instructions.

## GREEN Evidence
