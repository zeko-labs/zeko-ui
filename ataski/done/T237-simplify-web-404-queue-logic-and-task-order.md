---
id: T237
title: "Simplify WEB-404 queue logic and task order"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T23:17:59Z
updated_at: 2026-05-08T23:19:43Z
---

## Requirements

- Review WEB-404 cancellation queue logic for over-engineering.
- Keep the bridge parent/child flow XState-idiomatic: child operations report events to the parent, and the parent derives queue activation from its `operations` map.
- Remove redundant state or helpers where behavior remains equivalent.
- Move WEB-404 Ataski task records after the latest main task IDs so they do not collide with or interleave main's task history.
- Validate bridge-ui tests and typecheck.

## Test Plan

- DDD
- Use existing queue/recovery/operation regression tests as the RED/GREEN safety net.
- Run `moon run bridge-ui:test -f` and `moon run bridge-ui:typecheck -f`.

## RED Evidence

- The PR stored `operationsToUnpause` even though the next main-lane operation is fully derivable from `context.operations`.
- The PR added `bridgeCancellationSlot.ts` only to expose a one-line equality check for a unit test.
- WEB-404 Ataski tasks were interleaved with main's task IDs and created duplicate task numbers.

## GREEN Evidence

- Removed `operationsToUnpause` from bridge parent context and recovery sync state; main-lane promotion is derived from `operations` with `pausedMainQueueIds`.
- Inlined cancellation-slot release in the parent machine actions and removed the one-line helper/test file.
- Removed unused recovered `index` propagation and the redundant pending-recovery `lane` field.
- Rebuilt `ataski/tasks.md` from `origin/main` and appended WEB-404 task records as T195-T221, leaving main's T001-T194 entries untouched.
- Focused regression check passed: `pnpm exec vitest run test/unit/recovery.test.ts test/unit/bridge-operation.test.ts test/unit/helpers-queue.test.ts --project chromium`.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:test -f` passed: 16 files, 92 tests.
