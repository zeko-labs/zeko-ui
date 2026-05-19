---
id: T225
title: "Move skippable cancellable deposits out of main lane"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-26T00:00:00Z
updated_at: 2026-03-26T02:05:00Z
---

## Requirements

- Keep WEB-404 as a UI-only change. Do not change bridge-sdk or bridge-cli behavior for this requirement.
- A deposit that becomes cancellable is skippable and must leave the main lane immediately.
- The main lane must only contain claimable or otherwise non-cancellable work, in queue order.
- If the active main-lane deposit becomes cancellable, move it to the cancellation lane and resume the next main-lane operation automatically.
- A cancellable deposit must not be duplicated between the main lane and the cancellation lane.

## Test Plan

- TDD
- Add or update bridge-ui unit coverage around recovery sync planning and operation pausing/resuming before changing the bridge recovery logic.

## RED Evidence

- The current recovery sync keeps a started cancellable deposit in the main lane, which causes the main panel to keep showing a cancellable deposit instead of skipping it.

## GREEN Evidence

- Updated `apps/bridge-ui/machines/recovery.ts` so refresh planning always routes cancellable deposits into the cancellation lane, keeps the main lane strictly non-cancellable, and promotes the next main operation when the current one becomes skippable.
- Updated `apps/bridge-ui/machines/bridge.ts` to apply the refresh plan by pausing started operations that leave the main lane, resuming the next main-lane operation, and recomputing `activeOperation`/`operationsToUnpause`.
- Updated `apps/bridge-ui/machines/bridgeOperation.ts` to allow recovery-driven `Pause` transitions from pending and claimable states back into `PAUSED`.
- Added regression coverage in `apps/bridge-ui/test/unit/recovery.test.ts` and `apps/bridge-ui/test/unit/bridge-operation.test.ts`.
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
