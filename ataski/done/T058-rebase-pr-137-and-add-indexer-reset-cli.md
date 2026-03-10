---
id: T058
title: "Rebase PR 137 and add indexer reset CLI"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-09T17:26:39Z
updated_at: 2026-03-10T09:00:00Z
---

## Scope

Rebase PR 137 onto `main`, remove unnecessary `bridge-sdk` entrypoint churn, keep camelCase to snake-case changes limited to the CLI surface where they are required, and add an authenticated CLI reset command for the actions indexer that stops the indexer, clears table data, and restarts syncing from scratch.

## TDD Exception

This task starts with integrating an existing PR branch onto the latest `main` and correcting behavior across CLI, service runtime, and repository packaging boundaries. A pure RED-first test flow is not practical because the first hard gate is branch reconciliation and scope reduction on already-existing commits.

Validation strategy:

1. Rebase the PR branch onto `main` in an isolated worktree and resolve conflicts without widening scope.
2. Add or adjust focused tests around the CLI reset/auth behavior where coverage is practical.
3. Run the relevant Moon validation commands for the actions indexer before completing the task.

## GREEN Evidence

```bash
pnpm i
moon run actions-indexer:typecheck -f
moon run actions-indexer:lint -f
moon run actions-indexer:test-service-integration -f
```

Result:

- `pnpm i` completed successfully in the PR worktree, restoring the missing workspace toolchain so Moon tasks could run.
- `moon run actions-indexer:typecheck -f` passed after building `graphql`, `bridge-sdk`, and `actions-api`.
- `moon run actions-indexer:lint -f` passed.
- `moon run actions-indexer:test-service-integration -f` passed with all 5 tests green, including authenticated control-endpoint coverage, authenticated CLI reset coverage, and the existing kebab-case CLI flag coverage.
- Reran `moon run actions-indexer:typecheck -f`, `moon run actions-indexer:lint -f`, and `moon run actions-indexer:test-service-integration -f` after addressing PR review findings; all three passed again.
- Fetched the latest remote `main` to `origin/main` at commit `f2001f6` (`release: version packages (#138)`) and rebased the PR worktree branch on top of it with `git rebase --autostash origin/main`.
