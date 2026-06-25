---
id: T429
title: "Show pending for unindexed operations"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T06:17:17Z
updated_at: 2026-06-25T07:01:19Z
---

## Requirements

- Linear: WEB-504.
- Completed or cancelled operations whose terminal recovery is still unverified must display as `Pending`, not `Unindexed`.
- Preserve the pending status kind so styling remains consistent.
- Keep the existing debug scenario that reproduces local withdrawal completion before terminal recovery indexing.

## Test Plan

- TDD.
- RED: update/add a failing bridge operations table test that expects unverified completed/cancelled rows to show `Pending`.
- GREEN: update the status mapping only.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-sentry.test.ts test/unit/sentry-client-config.test.ts test/unit/bridge-operations-table.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-current-operation.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` failed: unverified completed and cancelled rows still mapped to `Unindexed` instead of `Pending`.

## GREEN Evidence

- `moon run bridge-ui:test` passed: 29 test files, 163 tests.
- `moon run bridge-ui:lint` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:build -f` passed.
