---
id: T395
title: "Guard terminal recovery action index"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T10:50:46Z
updated_at: 2026-06-19T10:59:58Z
---

## Requirements

- When `findPendingOperations` returns a terminal recovered operation that matches an existing local operation by id or transaction hash, it must only verify that actor if the local actor has no `actionIndex` yet or the local actor's `actionIndex` equals the recovered `actionState.index`.
- If the local actor already has a different `actionIndex`, skip terminal verification for that actor.
- Keep the change small: no new UI state, no duplicate completed operation behavior, and no mock-only special case.
- Preserve existing id/hash recovery matching for coherent SDK/indexer data.

## Test Plan

- TDD.
- RED: add a focused unit test proving terminal recovery with a matching hash but mismatched action index does not mark the local actor `verified` or overwrite its action index.
- GREEN: add the smallest guard in terminal recovery sync, then run the focused test, `bridge-ui:typecheck`, and `bridge-ui:test`.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts` failed before implementation.
- Failure: `does not verify a completed local operation from a terminal recovery with another action index` expected the local actor `actionIndex` to remain `1`, but terminal recovery overwrote it to `2`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts` passed after implementation.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:test` passed: 27 files, 148 tests.
