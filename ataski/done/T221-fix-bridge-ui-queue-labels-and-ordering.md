---
id: T221
title: "Fix bridge-ui queue labels and ordering"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-25T11:20:00Z
updated_at: 2026-03-25T11:42:00Z
---

## Requirements

- Replace the ambiguous `Next Transactions` heading with route-specific queue labels so the UI clearly says `Deposit Queue` on the deposit route and `Withdrawal Queue` on the withdrawal route.
- Ensure the visible queue order is deterministic and follows submission order, so deposits execute in the same order they were submitted.
- Do not rely on actor map iteration order for queue presentation or execution sequencing.
- Add meaningful automated coverage for the queue naming and ordering rules.

## Test Plan

- TDD
- Add or extend bridge-ui unit coverage for queue heading selection and submission-order sorting before refactoring the bridge UI state derivation, then run bridge-ui test and typecheck.

## RED Evidence

- The UI still renders `Next Transactions`, which hides whether the user is looking at a deposit queue or a withdrawal queue.
- The visible queue currently derives from actor map iteration in `Bridge.vue`, which is not a defensible source of submission ordering.

## GREEN Evidence

- Replaced the generic queue heading with route-specific labeling by introducing `queueTitleForDirection()` and rendering `Deposit Queue` / `Withdrawal Queue` in `apps/bridge-ui/app/components/Bridge.vue`.
- Stopped relying on actor map iteration for visible queue order by storing an explicit operation order in `apps/bridge-ui/machines/bridge.ts` and sorting queued cards with `sortByQueueOrder()` in the UI.
- Changed recovery ordering in `apps/bridge-ui/machines/recovery.ts` to use action index as the authoritative submission order, which is the execution order the user requested.
- Added bridge-ui coverage in `apps/bridge-ui/test/unit/recovery.test.ts` and `apps/bridge-ui/test/unit/helpers-queue.test.ts`.
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
