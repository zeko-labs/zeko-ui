---
id: T215
title: "Fix bridge Workers build failure on WEB-404 branch"
status: done
blockedBy: [T144]
owner: codex
created_at: 2026-03-24T14:21:07Z
updated_at: 2026-03-30T16:07:51Z
---

## Requirements

- Investigate the failing `Workers Builds: bridge` check on PR `#159` after the branch has been rebased or merged cleanly with `main`.
- Reproduce the failure locally using the bridge-ui build path and correct the underlying issue without changing the intended WEB-404 product behavior.
- Validate the resulting bridge-ui build and typecheck tasks from the repo root.

## Test Plan

- TDD
- Use the first failing local build or typecheck as RED evidence, then update the implementation until the bridge-ui build path passes.

## RED Evidence

- PR `#159` has a failed `Workers Builds: bridge` status check.
- The first test run in the new worktree failed before local dependencies were installed, so the worktree had to be bootstrapped before validating the real bridge-ui build path.

## GREEN Evidence

- `moon run bridge-ui:build` now passes locally on the merged branch.
- `moon run bridge-ui:typecheck` now passes locally on the merged branch.
- `moon run bridge-ui:test` also passes on the final WEB-404 cleanup pass.
