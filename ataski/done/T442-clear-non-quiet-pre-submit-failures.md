---
id: T442
title: "Clear non-quiet pre-submit failures"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T13:24:32Z
updated_at: 2026-06-25T13:29:00Z
---

## Requirements

- Address Codex review P1: any brand-new submit operation that fails before a transaction hash or recovered action index exists must be removed from the parent bridge active operation, not only wallet rejection failures.
- Preserve claim/finalization failures as retryable or visibly failed when they belong to a recovered or already-submitted operation.
- Preserve terminal recovery errors as visible completed-row failures instead of incorrectly removing indexed operations.

## Test Plan

- BDD.
- RED: add a bridge queue regression test proving a regular non-wallet submit failure before `context.transaction` clears `activeOperation` and removes the stale operation from the parent bridge.
- GREEN: broaden the pre-submit termination predicate to every unrecovered submit failure with no submitted transaction, while keeping existing claim retryability coverage passing.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts` failed as expected:
  - `removes a pre-submit non-wallet failure from the active main operation` observed a stale `activeOperation` id instead of `null`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts` passed: 1 file, 9 tests.
- `moon run -f bridge-ui:test -- test/unit/bridge-operation.test.ts` passed: 1 file, 24 tests.
- `moon run -f bridge-ui:format-fix` passed.
- `moon run -f bridge-ui:test` passed: 31 files, 178 tests.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:lint` passed.
- `git diff --check` passed.
