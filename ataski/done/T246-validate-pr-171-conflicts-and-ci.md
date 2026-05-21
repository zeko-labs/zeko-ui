---
id: T246
title: "validate-pr-171-conflicts-and-ci"
status: done
blockedBy: [T197]
owner: codex
created_at: 2026-05-08T23:09:29Z
updated_at: 2026-05-08T23:23:10Z
---

## Requirements

- Sync PR #171 with `origin/main` and resolve merge conflicts without dropping the bridge-sdk functional-core refactor or the T197 cancellation split.
- Run the relevant local validation suite for bridge-sdk and dependent bridge surfaces before pushing.
- Commit completed Ataski board state with the code changes before publishing.
- Push `branch/web-460-bridge-sdk-functional-core` and verify GitHub has started checks for PR #171.
- Update Linear issue WEB-460 with the final PR and validation status.

## Test Plan

- BDD validation at the PR level: after conflicts and review fixes are resolved, run the bridge-sdk tests, typecheck, build, lint, and selected bridge-cli / bridge-ui tests that exercise SDK-facing bridge flows.
- Verify `gh pr checks` or the PR status rollup reports CI checks as queued, in progress, or completed after push.

## RED Evidence

- T197 completed, so this task is unblocked. PR #171 previously reported `mergeStateStatus: DIRTY` and no PR checks on `branch/web-460-bridge-sdk-functional-core`, so validation must merge `origin/main`, push, and confirm CI starts.

## GREEN Evidence

- Merged `origin/main` into `branch/web-460-bridge-sdk-functional-core`; the only manual conflict was `ataski/tasks.md`.
- Resolved the Ataski ID collision by keeping main's `T193`/`T194` and renumbering this PR's board entries to `T195`-`T198`.
- `moon run bridge-sdk:test -f` passed after merge: 6 files, 26 tests.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-sdk:build -f` passed.
- `moon run bridge-sdk:lint -f` passed with only the pre-existing `ExtractInput<any>` warnings in `packages/bridge-sdk/src/types.ts`.
- `moon run bridge-cli:test -f -- tests/direct-commands.test.ts tests/bridge-flow.test.ts` passed: 2 files, 31 passed, 13 skipped.
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts test/unit/transaction-machine.test.ts` passed: 2 files, 11 tests.
- `moon run bridge-ui:typecheck -f` passed.
