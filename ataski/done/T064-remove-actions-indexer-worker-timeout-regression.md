---
id: T064
title: "Remove actions indexer worker timeout regression"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T00:00:00Z
updated_at: 2026-03-11T09:01:29Z
---

## Scope

Remove the hard worker subprocess timeout introduced in the actions indexer runtime, keep worker-only execution, improve observability for long-running worker chunks, and clean up loop error logging so production failures are reported accurately.

## TDD Exception

This is a production regression hotfix on an already-merged code path. A RED-first test flow is not practical because the first requirement is restoring safe runtime behavior in the worker path without relying on the current production timeout failure as the specification.

Validation strategy:

1. Add focused runtime test coverage for worker success and worker failure paths without asserting any forced timeout behavior.
2. Run the actions-indexer typecheck, lint, and service integration validation in the fresh worktree.

## GREEN

- `pnpm --filter @zeko/actions-indexer exec vitest run test/action-processing.runtime.test.ts`
  - Passed. Covers main-thread execution, missing worker entrypoint, worker success, non-zero worker exit, and invalid worker JSON rejection.
- `moon run actions-indexer:typecheck -f`
  - Passed.
- `moon run actions-indexer:lint -f`
  - Passed.
- `moon run actions-indexer:test-service-integration -f`
  - Passed. Service lifecycle, control endpoint auth, reset behavior, and CLI integration checks all completed successfully.
