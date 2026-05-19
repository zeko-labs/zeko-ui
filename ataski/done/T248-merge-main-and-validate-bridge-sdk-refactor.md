---
id: T248
title: "merge-main-and-validate-bridge-sdk-refactor"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-19T12:47:37Z
updated_at: 2026-05-19T12:57:03Z
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

- Resolved `origin/main` merge conflicts by preserving the split bridge-sdk facade/modules and porting new main behavior into `runtime`, `deposits`, and `withdrawals`.
- `moon run bridge-sdk:test -f` passed: 8 files, 40 tests.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-sdk:build -f` passed.
- `moon run bridge-sdk:lint -f` passed with the pre-existing `ExtractInput<any>` warnings in `packages/bridge-sdk/src/types.ts`.
- `moon run bridge-cli:test -f -- tests/direct-commands.test.ts tests/bridge-flow.test.ts tests/adapter.test.ts tests/bridge-queue.test.ts` passed: 4 files, 52 passed, 13 skipped.
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts test/unit/bridge-versions.test.ts test/unit/helpers-queue.test.ts test/unit/helpers-status.test.ts test/unit/recovery.test.ts` passed: 5 files, 42 tests.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
