---
id: T226
title: "Hide empty queues and align timeout copy with cancellability"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-26T00:00:00Z
updated_at: 2026-03-26T02:31:00Z
---

## Requirements

- Do not render the `Deposit Queue` or `Withdrawal Queue` sections when their queue is empty.
- Do not show `Timed out` for a deposit that is still in the main queue and not actually cancellable.
- Keep remaining-time metadata for queued deposits, but align the timeout wording with real cancellability so the UI does not claim a queue item is timed out while it is still treated as non-cancellable work.

## Test Plan

- TDD
- Update queue metadata tests first to cover expired-but-not-cancellable deposits and cancellable timed-out deposits, then patch the Bridge UI rendering to hide empty queue sections.

## RED Evidence

- The bridge UI still renders empty queue sections.
- Queue metadata can display `Timed out` based only on slot arithmetic even when the deposit is still in the main queue.

## GREEN Evidence

- Updated `apps/bridge-ui/app/helpers.ts` so timeout metadata only says `Timed out` when the deposit is actually cancellable, avoiding false timed-out copy for deposits that are still in the main queue.
- Updated `apps/bridge-ui/app/components/QueuedOperation.vue` and `apps/bridge-ui/app/components/CancellableOperation.vue` to thread cancellability into timeout metadata rendering.
- Updated `apps/bridge-ui/app/components/Bridge.vue` so the deposit and withdrawal queue sections are omitted entirely when their queue is empty.
- Updated `apps/bridge-ui/README.md` to document that queue sections are shown only when they have items.
- Added regression coverage in `apps/bridge-ui/test/unit/helpers-queue.test.ts`.
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
