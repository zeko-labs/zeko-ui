---
id: T143
title: "Merge main and resolve PR conflicts"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T12:42:00Z
updated_at: 2026-03-24T12:49:00Z
---

## Requirements

- Merge `origin/main` into `branch/emmanuel/web-406-improved-cancellation-sdk` in the dedicated worktree.
- Resolve any conflicts without dropping the deposit queue-ordering, SDK cancellability, CLI/UI changes, or the recent UI safety revert.
- Preserve the branch-specific release metadata and documentation changes unless the merge clearly supersedes them.
- Push the repaired branch once the merge is complete.

## Test Plan

- DDD
- Inspect the conflicted files, resolve each conflict directly, and rerun the relevant Moon tasks for the packages affected by the final merged result.

## RED Evidence

## GREEN Evidence

- 2026-03-24: `git merge --no-edit origin/main` conflicted only in `ataski/tasks.md`
- 2026-03-24: resolved the Ataski ID collision by preserving `origin/main` task IDs and renumbering the branch-local bridge tasks to `T139`-`T142`, with this merge task recorded as `T143`
