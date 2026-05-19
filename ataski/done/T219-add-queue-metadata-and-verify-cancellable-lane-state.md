---
id: T219
title: "Add queue metadata and verify cancellable lane state"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T15:38:42Z
updated_at: 2026-03-24T15:49:58Z
---

## Requirements

- Explain and verify the current cancellable-lane behavior against live SDK data for the validation wallet, so we can distinguish a real UI bug from the current queue state.
- Extend recovered queue cards to show more useful metadata under `Next Transactions`, including a submitted datetime and deposit timeout information when available.
- Thread any needed timeout metadata from the SDK recovery data through bridge-ui state without changing the SDK.
- Add meaningful automated coverage for the new queue metadata formatting.

## Test Plan

- TDD
- Add unit coverage for the queue metadata formatter first, then patch the worker/UI flow and rerun the bridge-ui test and typecheck tasks.

## RED Evidence

- The queue cards currently show only status and amount, which is not enough context for pending recovered deposits.
- Live SDK data for the validation wallet currently reports unresolved deposits with `cancellable: false`, so the dedicated cancellable lane has nothing to render right now.

## GREEN Evidence

- Live `deposit status --latest false --json` for `B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq` still reports all unresolved deposits with `cancellable: false`, so the dedicated `Cancellable Deposits` lane has no data to render yet.
- Threaded recovered `deposit.timeout` into bridge-ui action state as `timeoutSlot` and rendered queue metadata in the queued and cancellable cards.
- Added `apps/bridge-ui/test/unit/helpers-queue.test.ts` to cover submitted datetime formatting and deposit timeout display.
- `moon run bridge-ui:test`
- `moon run bridge-ui:typecheck`
