---
id: T423
title: "Merge main after debug mode"
status: done
blockedBy: []
owner: Codex
created_at: 2026-06-20T07:19:18Z
updated_at: 2026-06-20T07:25:00Z
---

## Requirements

- Merge current `origin/main` into PR #220 so the branch is mergeable.
- Preserve the `main` bridge-ui debug-mode changes as source of truth where they overlap with this branch.
- Preserve the bridge finality, CLI diagnostics, wallet env, dashboard, and validator changes already in #220.
- Resolve Ataski/task-board conflicts by preserving main's debug-mode task block and renumbering the PR-local finality task block after it.

## Test Plan

- Test Strategy Exception: this is a merge-conflict resolution task. Validate by completing the merge, checking conflict-free status, and running targeted affected project validation plus `git diff --check`.

## RED Evidence

- GitHub reports PR #220 as `CONFLICTING` against `main`.

## GREEN Evidence

- Merge conflict was limited to `ataski/tasks.md`.
- Preserved `origin/main` bridge-ui debug-mode files and renumbered PR-local Ataski files to avoid duplicate task IDs.
- `moon run bridge-ui:test bridge-ui:typecheck -f` passed: 27 bridge-ui test files, 153 tests, plus typecheck.
- `moon run bridge-cli:test -f -- tests/package-boundary.test.ts tests/create-wallet-env.test.ts` passed: 2 files, 9 tests.
- `moon run docs:test -f` passed: 2 files, 8 passed, 1 skipped.
- `git diff --check` passed.
