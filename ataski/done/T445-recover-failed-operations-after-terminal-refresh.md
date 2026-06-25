---
id: T445
title: "Recover failed operations after terminal refresh"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T14:04:49Z
updated_at: 2026-06-25T14:09:41Z
---

## Requirements

- Resolve Codex review finding: a post-submit failed operation retained for visible UI feedback must still reconcile if a later backend refresh reports the same operation as finalized or cancelled.
- Keep post-submit backend failures visible and inactive so users do not enter a claim loop.
- Do not make debug mode compensate for bridge-state bugs; recovery must work through normal bridge sync events.

## Test Plan

- TDD.
- RED: add bridge refresh queue coverage where a recovered withdrawal fails during claim, then a later refresh reports the same operation finalized, and the actor must leave Failed with verified completion.
- GREEN: keep failed actors live enough to accept recovery events while preserving active-slot release.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-operation.test.ts test/unit/bridge-refresh-queue.test.ts` failed as expected: `reconciles a failed recovered claim when a terminal refresh arrives` stayed in `FAILED`, and XState warned that `VerifyCompletion`/`RecoverBridgeOperationCompleted` were sent to a stopped actor.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-operation.test.ts test/unit/bridge-refresh-queue.test.ts` passed: 2 files, 35 tests.
- `moon run -f bridge-ui:format-fix` passed.
- `moon run -f bridge-ui:test` passed: 31 files, 180 tests.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:lint` passed.
- `git diff --check` passed.
