---
id: T230
title: "Harden bridge-ui queue render validation"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-30T16:02:00Z
updated_at: 2026-03-30T16:07:51Z
---

## Requirements

- Extract the top-level queue/lane derivation in bridge-ui into a pure internal helper so the rendered queue state is directly unit-testable.
- Add regression coverage for the expected WEB-404 queue behavior:
- main lane contains only non-cancellable work
- deposits sort ahead of withdrawals in main-lane order
- cancellable deposits appear only in `Cancellable Deposits`
- empty `Deposit Queue` and `Withdrawal Queue` sections are hidden
- Keep the change internal to bridge-ui and avoid new public APIs.

## Test Plan

- TDD
- Add the queue derivation tests first, then patch bridge-ui only if the new tests expose a real mismatch.

## RED Evidence

- `pnpm exec vitest run test/unit/helpers-queue.test.ts` failed with `The requested module '/app/helpers.ts' does not provide an export named 'deriveBridgeQueues'`.

## GREEN Evidence

- Added `deriveBridgeQueues(...)` in `apps/bridge-ui/app/helpers.ts` and switched `apps/bridge-ui/app/components/Bridge.vue` to consume it.
- Added queue derivation coverage in `apps/bridge-ui/test/unit/helpers-queue.test.ts` for cancellable-lane separation and empty main-lane queues.
- `pnpm exec vitest run test/unit/helpers-queue.test.ts`
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
