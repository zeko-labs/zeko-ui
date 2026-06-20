---
id: T388
title: "fix-debug-deposit-queue-and-completed-hash"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T05:48:28Z
updated_at: 2026-06-19T05:59:24Z
---

## Requirements

- Reproduce the reported debug flow faithfully: seed three deposits, complete the active deposit claim path, and verify the next queued main-lane deposit becomes active instead of clearing the UI back to an input-ready state.
- Treat the queue symptom as a possible real bridge-machine bug. Do not add mock backend auto-healing, artificial queue advancement, or debug-only behavior that hides a broken parent/child operation transition.
- If the bug is in production bridge queue handling, fix the bridge-machine logic so completed main-lane operations resume the next paused main-lane operation consistently.
- If the bug is in the mock backend contract, fix the mock to return realistic SDK/backend answers. In a seeded deposit queue, completing a deposit claim must finalise the oldest pending seeded deposit, not the newest one.
- Add a transaction hash column to the completed transactions UI so completed deposits/withdrawals can be correlated with debug/backend operation records.
- Keep the completed transaction hash readable in the existing compact table layout and preserve existing completed transaction data.

## Test Plan

- TDD/BDD. First add a failing bridge-machine unit test that models multiple recovered deposits and a completed active deposit; the expected behavior is that the parent activates the next paused main-lane operation.
- TDD/BDD. If investigation points to a mock backend contract issue, add a failing mock-worker test proving completed seeded deposit claims finalise the oldest pending deposit.
- TDD/BDD. Add a failing completed-transaction view/model or table test that expects completed transaction rows to expose/render their hash.
- GREEN requires the focused unit tests to pass, followed by bridge-ui lint/typecheck/test validation.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operations-table.test.ts` failed as expected:
  - `marks the oldest pending seeded deposit finalised when claim completes` showed the mock finalised `debug-deposit-3` instead of `debug-deposit-1`.
  - `bridge-operations-table.test.ts` failed to import `bridgeOperationHashColumn`, proving the completed transaction hash column is missing.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/bridge-operations-table.test.ts` passed: 2 files, 14 tests.
- `moon run bridge-ui:lint` passed: Biome checked 106 files with no fixes.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test` passed: 25 files, 135 tests.
- `git diff --check` passed.
