---
id: T492
title: "Preserve rebuild and refresh ordering"
status: done
blockedBy: [T491]
owner: codex
created_at: 2026-07-28T19:17:19Z
updated_at: 2026-07-28T19:21:20Z
---

## Requirements

- Keep outer and inner rebuild ownership isolated so either rebuild clears and
  replaces only its own tables while coordinated full resets still clear all
  action tables.
- Preserve independent outer, inner, and registry rebuild settlement without
  allowing one successful stream to erase another successful stream's data.
- Serialize authenticated Ethereum asset registry refreshes so overlapping
  calls cannot install an older root/count after a newer append.
- Preserve atomic replacement of the authenticated registry and Bridge runtime
  consumers, including recovery after a failed refresh.
- Keep the registry full-rescan optimization deferred and do not run proving
  or deployment.

## Test Plan

- TDD.
- Add focused regressions proving outer and inner table clearing are disjoint
  and full action clearing composes both operations.
- Add a concurrent refresh regression with a deferred older runtime response
  that proves only one refresh authenticates at a time and the final installed
  checkpoint is the newest append.
- Per the review-fix constraint, write the regressions before implementation
  but defer execution until one consolidated focused verification after all
  fixes are applied.

## RED Evidence

- `outerRebuild` and `innerRebuild` each call `clearActionTables`, which
  deletes witness, commit, outer, and inner rows; concurrent successful
  rebuilds can therefore erase each other's committed data while both cursors
  advance.
- `refreshAssetRegistry` passes the currently installed registry into an
  asynchronous refresh before awaiting runtime authentication, so overlapping
  calls can both validate from the same old checkpoint and assign in response
  completion order.
- Existing tests cover atomic failure replacement and independent loop
  cursors, but do not cover disjoint rebuild table ownership or overlapping
  refresh ordering.
- Regression execution is deferred to the single final verification required
  by this review-fix round.

## GREEN Evidence

- `git diff --check` passed.
- Dprint checks passed for the six touched TypeScript source and test files.
- The focused `@zeko-labs/eth-bridge-sdk` TypeScript check passed.
- `test/client.test.ts` passed all 11 tests, including serialized overlapping
  refreshes and recovery after a rejected refresh.
- The focused `@zeko/actions-indexer` TypeScript check passed.
- `test/db-clear.test.ts` and `test/indexer.test.ts` passed all 8 tests,
  including disjoint stream clearing and coordinated full clearing.
- Verification used package-local commands because this isolated worktree's
  generated Moon root project ID begins with a digit and is rejected before
  task execution.
- No full repository suites, proving, deployment, or registry full-rescan
  optimization were run.
