---
id: T392
title: "queue-new-recovered-main-operations"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T06:45:04Z
updated_at: 2026-06-19T06:58:54Z
---

## Requirements

- Fix the seed withdrawal then seed deposit debug flow without making debug mode smarter than the real bridge.
- When SDK recovery returns a newly discovered pending main-lane operation while another main operation is already active, the new operation must be added as paused/queued and must not become the main operation before the active operation is claimed/completed.
- The queue must preserve bridge ordering rules: pending deposits sort before pending withdrawals for recovered SDK state, but a currently active main operation remains active until claimed/completed.
- Waiting for the periodic refresh must not reorder the main lane so an unclaimed queued deposit becomes current ahead of an active withdrawal.
- Update `BUGS.md` only for actual bridge-code bugs being fixed.

## Test Plan

- TDD. First add a failing bridge-ui unit test for the bridge recovery sync model: given an active recovered withdrawal and a newly discovered pending deposit, the active withdrawal remains started and the new deposit is added paused in the main lane.
- GREEN requires focused tests for recovery/queue sync and debug panel controls, followed by bridge-ui lint/typecheck/test.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/recovery.test.ts` failed on `keeps the active main operation ahead of newly recovered queued operations`: recovery kept only the matched withdrawal and dropped the newly recovered deposit instead of adding it paused behind the active main operation.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/recovery.test.ts` passed: 11 tests.
- `moon run bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts` passed: 1 test.
- `moon run bridge-ui:lint` passed: Biome checked 108 files with no fixes.
- `git diff --check` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test` passed: 27 files, 138 tests.
