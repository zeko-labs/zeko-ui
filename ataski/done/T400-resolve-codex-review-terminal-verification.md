---
id: T400
title: "Resolve Codex review terminal verification findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T15:38:53Z
updated_at: 2026-06-19T21:09:53Z
---

## Requirements

- Address the Codex review finding where `syncRecoveredOperations` can mark a parent operation entry as completed after terminal recovery while the child actor remains in a live state with active pollers and pending status.
- Address the Codex review finding where locally cancelled operations with `completionVerification: "unverified"` render as `Cancelled` instead of the yellow `Unindexed` pending label.
- Address the Codex review finding where a refresh can start a newly recovered main-lane operation while an existing local main operation is still active but not yet returned by `findPendingOperations`.
- Address the Codex review finding where terminal recovery can send a duplicate child-to-parent completion event after refresh already promoted another main operation, clearing `activeOperation` while a main operation is started.
- Address the Codex review finding where seeded debug backend operations can reuse the next mock-submitted transaction hash, breaking realistic recovery matching by transaction hash.
- Address the Codex review finding where a terminal recovery row that collides with the active operation by id/hash but fails action-index verification can still release the active operation and start queued main-lane work.
- Keep debug mode faithful to SDK-shaped recovery answers. Do not add debug-only workarounds or hide actual bridge logic bugs.

## Test Plan

- TDD.
- Add failing unit coverage for terminal recovery syncing a live matched actor into the correct done state, proving actor state and parent entry agree after recovery.
- Add failing unit coverage for unverified cancelled table rows rendering as `Unindexed` with pending styling while verified cancellations still render as cancelled.
- Add failing unit coverage for preserving an unmatched active local main operation during refresh, proving newly recovered main operations are queued paused behind it.
- Add failing unit coverage for terminal recovery completing the active main operation while promoting the next queued operation, proving the promoted actor remains the parent `activeOperation` after child terminal actions settle.
- Add failing unit coverage for seeded debug operations and mock-submitted operations using unique fake transaction hashes.
- Add failing unit coverage for rejecting a mismatched terminal recovery without changing the active main operation or unpausing queued work.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts test/unit/bridge-operations-table.test.ts` failed with the intended assertions:
  - live matched terminal recovery left the child actor outside `BRIDGE_OPERATION_DONE_NOOP`
  - unverified cancelled rows returned `{ text: "Cancelled", kind: "cancelled" }` instead of `{ text: "Unindexed", kind: "pending" }`
- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts` failed on `queues recovered main operations behind an active local operation that is not indexed yet`: refresh changed `activeOperation` from the local `bridgeOperation-*` actor to recovered `debug-deposit-1`.
- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts test/unit/mock-backend-worker.test.ts` failed on the two accepted Codex review regressions:
  - terminal recovery completion cleared `activeOperation` to `null` after promoting `debug-deposit-2`
  - seeded and submitted debug operations reused `5Jdebug000001`
- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts` failed on `keeps the active operation when a terminal recovery with another action index is rejected`: refresh changed `activeOperation` from `debug-withdrawal-1` to queued `debug-deposit-2`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts test/unit/mock-backend-worker.test.ts` passed: 2 files, 16 tests.
- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-operations-table.test.ts test/unit/helpers-progress.test.ts` passed: 5 files, 45 tests.
- `moon run -f bridge-ui:lint` passed: Biome checked 109 files with no fixes.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:test` passed: 27 files, 152 tests.
- `moon run -f bridge-ui:build` passed with existing warnings for stale browser data, o1js eval, chunk size, and the PWA `_payload.json` glob.
- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts` passed: 1 file, 6 tests.
- `moon run -f bridge-ui:lint` passed: Biome checked 109 files with no fixes.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:test` passed: 27 files, 153 tests.
- `moon run -f bridge-ui:build` passed with existing warnings for stale browser data, o1js eval, chunk size, and the PWA `_payload.json` glob.

## Review Status

- `.agents/skills/codex-review/scripts/codex-review --mode branch` was rerun after the quota window and reported one accepted/actionable P2 finding: mismatched terminal recovery could still release the active operation before the action-index check rejected verification.
- `.agents/skills/codex-review/scripts/codex-review --mode branch` was rerun after that follow-up fix and completed cleanly: no accepted/actionable findings. The review reported the bridge-ui unit suite and typecheck passing against the reviewed changes.
