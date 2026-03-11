---
id: T071
title: "Merge origin main and resolve web-395 conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-03-11T16:58:07Z
updated_at: 2026-03-11T16:58:07Z
---

## Requirements

- Merge `origin/main` into `branch/web-395-missing-bridge-history` in the canonical worktree and resolve all resulting conflicts without dropping the WEB-395 changes already landed on the branch.
- Preserve the canonical-progression, loop-failure isolation, bridge diagnostics, and Ataski board updates unless `origin/main` contains a clearly newer compatible version that should supersede them.
- Re-run the affected automated validation after conflict resolution and record the exact GREEN evidence on this task.
- Commit the merge resolution on the canonical branch using the repo's conventional commit and Lefthook rules.

## Test Plan

- DDD
- Perform the merge first to surface the true integration breakpoints, then resolve each conflict against the intended WEB-395 behavior and rerun the relevant indexer and bridge-sdk validations.
- Record a test-strategy exception before source edits because merge conflicts cannot be meaningfully exercised with a RED test before the upstream diff is known.

## RED Evidence

## Test Strategy Exception

The integration work depends on the exact delta from `origin/main`, so there is no useful RED test to run before the merge reveals the actual conflicts. This task will treat the merge as the discovery step, then rerun the affected automated validations after the resolutions land.

## GREEN Evidence
