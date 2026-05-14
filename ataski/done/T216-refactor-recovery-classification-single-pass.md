---
id: T216
title: "Refactor recovery classification to a single-pass implementation"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T14:40:01Z
updated_at: 2026-03-24T14:51:16Z
---

## Requirements

- Refactor `apps/bridge-ui/machines/recovery.ts` so `classifyRecoveredOperations` no longer performs repeated filter/map passes over the recovered deposits and withdrawals.
- Preserve the existing WEB-404 behavior:
  - cancellable deposits go to the cancellation lane
  - non-cancellable deposits and withdrawals go to the serialized main lane
  - finalized and cancelled history buckets remain intact
- Keep the helper readable and deterministic, including the current recovery ordering rules.
- Add or update unit coverage so the refactor is protected against regressions.

## Test Plan

- TDD
- Expand the recovery unit tests first to cover completed buckets and same-timestamp tie-breaking, then refactor the implementation until the suite passes.

## RED Evidence

- `classifyRecoveredOperations` currently re-scans the same arrays through multiple filter/map passes.

## GREEN Evidence

- Refactored `apps/bridge-ui/machines/recovery.ts` into a single-pass accumulator for deposits and withdrawals.
- Added recovery tests for completed buckets and same-timestamp tie-breaking.
- `moon run bridge-ui:test -- test/unit/recovery.test.ts`
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
