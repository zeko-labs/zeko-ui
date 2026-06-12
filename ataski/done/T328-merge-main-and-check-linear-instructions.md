---
id: T328
title: "Merge main and check Linear instructions"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T21:44:49Z
updated_at: 2026-06-10T21:47:56Z
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

- Merged `origin/main` into `branch/actions-ops-dashboard`.
- Resolved the only merge conflict in `ataski/tasks.md`.
- Preserved main's `T298-T307` task IDs and renumbered dashboard branch tasks to `T308-T328` to avoid duplicate task lines.
- Re-read merged `AGENTS.md`: it now includes a `Linear and PRs` section requiring closing magic words such as `Fixes WEB-123`, relying on GitHub integration for automatic closure, avoiding Linear progress comments/description updates unless explicitly requested, and avoiding non-closing `Refs` references when closure is intended.
- Merged `AGENTS.md` still does not specify which Linear team to use.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:test` passed with 14 tests after rerunning a transient Moon cache parse failure.
