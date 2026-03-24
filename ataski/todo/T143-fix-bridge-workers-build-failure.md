---
id: T143
title: "Fix bridge Workers build failure on WEB-404 branch"
status: todo
blockedBy: [T142]
owner: unassigned
created_at: 2026-03-24T14:21:07Z
updated_at: 2026-03-24T14:21:07Z
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

## GREEN Evidence

