---
id: T200
title: "merge-main-and-validate-bridge-sdk-refactor"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-19T12:47:37Z
updated_at: 2026-05-19T12:47:37Z
---

## Requirements

- Fetch and merge `origin/main` into `branch/web-460-bridge-sdk-functional-core`.
- Resolve conflicts while preserving the bridge-sdk facade refactor, cancellation split, and changeset.
- Review any new bridge-related main-branch changes and integrate them with the refactor.
- Run bridge-sdk and affected bridge-cli / bridge-ui validation before publishing.
- Commit and push the updated PR branch.

## Test Plan

- Test Strategy Exception: this is a merge/integration task, not a new behavior change. Existing bridge-sdk characterization tests and affected consumer tests are the correctness gate.
- GREEN requires bridge-sdk test/typecheck/build/lint and affected bridge-cli / bridge-ui checks to pass or a concrete external blocker.

## RED Evidence

- Exception recorded before merge edits. PR branch is clean before fetching and merging `origin/main`.

## GREEN Evidence

- Pending.
