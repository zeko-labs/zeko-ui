---
id: T400
title: "Resolve bridge debug PR conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-20T05:35:19Z
updated_at: 2026-06-20T05:35:42Z
---

## Requirements

- Update PR #219's `branch/bridge-ui-debug-mode` against `origin/main`.
- Resolve merge conflicts without changing bridge behavior beyond reconciling the existing PR work with current main.
- Preserve the Linear issue references on PR #219.
- Push the resolved branch and squash merge the PR when GitHub reports it is mergeable.

## Test Plan

- Test Strategy Exception: this task resolves integration conflicts between an already-reviewed PR branch and current `main`; there is no new intended behavior to express with a RED test before conflict markers exist.
- Validate with the bridge-ui checks needed for affected files after conflicts are resolved.

## RED Evidence

- GitHub reported PR #219 as `mergeable: CONFLICTING` and `mergeStateStatus: DIRTY`.

## GREEN Evidence
