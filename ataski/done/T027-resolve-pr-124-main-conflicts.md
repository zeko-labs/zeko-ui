---
id: T027
title: "Resolve PR 124 main merge conflicts"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-02T17:02:05Z
updated_at: 2026-03-02T17:12:20Z
---

Task scope: merge `main` into `epic/faucet-api-cli-refactor` and resolve conflicts for PR #124.

## TDD Exception

This task is a merge-conflict resolution against `main`, so there is no stable pre-edit red test that isolates the conflict itself.
Validation will use a clean merge attempt plus focused project checks on the affected code after the conflicts are resolved.

## GREEN Evidence

- `git merge --no-edit origin/main` produced conflicts only in `package.json` and `pnpm-lock.yaml`.
- `pnpm install --lockfile-only --ignore-scripts` completed successfully and reported that the `pnpm-lock.yaml` merge conflict was successfully merged.
- `pnpm install` completed successfully in the worktree.
- `pnpm exec lefthook install` completed successfully.
- `pnpm exec lefthook validate` returned `All good`.
- `pnpm exec moon --version` reported `2.0.3`, confirming the repo-local Moon v2 binary.
- `pnpm exec moon run :lint-fix` completed successfully.
- `pnpm exec moon run :format-all-fix` completed successfully.
- `pnpm exec lefthook run pre-commit` completed successfully after updating `lefthook.yaml` to call the repo-local Moon v2 binary with a scoped `:format-all-fix` target.
