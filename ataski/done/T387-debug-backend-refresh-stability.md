---
id: T387
title: "debug-backend-refresh-stability"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T05:33:39Z
updated_at: 2026-06-19T05:39:12Z
---

## Requirements

- Keep debug mode faithful to SDK/backend answers; do not add queue auto-healing, auto-pruning, or bridge-machine behavior changes that could hide real UI bugs.
- A real browser refresh/new debug backend store instance must start with fresh volatile mock backend state: no seeded operations, no pending signature requests, no call log, no forced one-shot error, and reset counters/slots.
- The selected debug scenario is a user preference and must survive a real browser refresh/new store instance when it is valid.
- The explicit debug panel controls must remain the way to add recovered deposit/withdrawal operations, sync backend answers, simulate app recovery, reset the mock backend, and clear completed UI transactions.
- Any change to clear completed transactions must be user-triggered and must not make the bridge queue advance or hide suspected queue/claim bugs automatically.

## Test Plan

- TDD. First add focused unit tests proving that a new debug backend store restores only the selected scenario from storage while dropping volatile mocked backend state.
- TDD. Add/adjust debug panel controller tests only for user-triggered controls; do not encode auto-fixing behavior for operation queues.
- GREEN requires the focused bridge-ui unit tests to pass, then bridge-ui lint/typecheck/test validation.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts` failed on `keeps only the selected scenario across a fresh debug backend page load`: the new store restored volatile state (`calls`, `signatureRequests`, `seededOperations`, `forcedError`, `currentSlot`, and counters) from storage instead of starting fresh while preserving the selected scenario.

## GREEN Evidence

- `moon run bridge-ui:test -- test/unit/mock-backend-worker.test.ts` passed: 11 tests, including the new fresh debug backend page-load contract.
- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts` passed: 4 tests.
- `moon run bridge-ui:lint` passed: Biome checked 106 files with no fixes.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test` passed: 25 files, 133 tests.
