---
id: T204
title: "Resolve cleanup PR base conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-13T06:24:28Z
updated_at: 2026-05-13T06:24:28Z
---

## Requirements

- Merge the latest `branch/t165-bridge-cli-sdk-resume-fix` base branch into `branch/bridge-cli-cleanup-refactor`.
- Resolve conflicts without dropping the new base-branch behavior or the bridge CLI cleanup/refactor changes already on the PR branch.
- Preserve the package README/env-precedence updates already pushed on this branch.
- Validate bridge CLI behavior after conflict resolution and push the PR branch.

## Test Plan

- TDD exception: conflict resolution does not have a meaningful RED test before merge because the failing state is Git's conflict marker state. Record the merge conflict files as RED evidence, then validate with the bridge CLI test/typecheck/lint/build suite after resolution.

## RED Evidence

## GREEN Evidence
