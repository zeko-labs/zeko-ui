---
id: T175
title: "Let SDK drive CLI deposit resolution"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T22:55:00Z
updated_at: 2026-05-06T23:06:00Z
---

## Requirements

- The Bridge CLI must not remain blocked only because its own deposit status queue analysis cannot identify a `claimableIndex`.
- When `canFinalizeDeposit` reports `available: true`, the bridge runner must call `finalizeDeposit`; the SDK already chooses the next resolvable deposit.
- Keep the change small and avoid adding new queue abstractions or duplicating SDK logic.
- Preserve existing behavior for cancellation and completion detection.

## Test Plan

- BDD: add a bridge-flow test for the user-visible CLI behavior where the status snapshot shows a submitted deposit but does not mark it confirmed, while the SDK capability says finalization is available. The expected behavior is that the CLI still calls `finalizeDeposit` and completes after the next status refresh.
- Run the focused bridge-flow test first and record the failing assertion before changing runtime code.

## RED Evidence

- `moon run bridge-cli:test -f -- bridge-flow.test.ts -t "lets the SDK finalize"` failed as expected. The new test expected `finalizeDeposit` to be called when `canFinalizeDeposit` returned `{ available: true }`, but the CLI left `finalizeCalls` empty because its own `claimableIndex` gate blocked the SDK call.

## GREEN Evidence

- `moon run bridge-cli:test -f -- bridge-flow.test.ts -t "lets the SDK finalize"` passed.
- `moon run bridge-cli:test -f -- bridge-flow.test.ts bridge-queue.test.ts operation-command.test.ts` passed with 42 tests.
- `moon run bridge-cli:lint-fix -f` passed.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:build -f` passed.
- `moon run bridge-cli:test -f` passed with 91 tests.
