---
id: T196
title: "validate-pr-171-conflicts-and-ci"
status: in-progress
blockedBy: [T195]
owner: codex
created_at: 2026-05-08T23:09:29Z
updated_at: 2026-05-08T23:18:30Z
---

## Requirements

- Sync PR #171 with `origin/main` and resolve merge conflicts without dropping the bridge-sdk functional-core refactor or the T195 cancellation split.
- Run the relevant local validation suite for bridge-sdk and dependent bridge surfaces before pushing.
- Commit completed Ataski board state with the code changes before publishing.
- Push `branch/web-460-bridge-sdk-functional-core` and verify GitHub has started checks for PR #171.
- Update Linear issue WEB-460 with the final PR and validation status.

## Test Plan

- BDD validation at the PR level: after conflicts and review fixes are resolved, run the bridge-sdk tests, typecheck, build, lint, and selected bridge-cli / bridge-ui tests that exercise SDK-facing bridge flows.
- Verify `gh pr checks` or the PR status rollup reports CI checks as queued, in progress, or completed after push.

## RED Evidence

- T195 completed, so this task is unblocked. PR #171 previously reported `mergeStateStatus: DIRTY` and no PR checks on `branch/web-460-bridge-sdk-functional-core`, so validation must merge `origin/main`, push, and confirm CI starts.

## GREEN Evidence

- Pending.
