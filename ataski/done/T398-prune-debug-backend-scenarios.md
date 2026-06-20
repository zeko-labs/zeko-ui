---
id: T398
title: "Prune debug backend scenarios"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T12:49:41Z
updated_at: 2026-06-19T12:55:23Z
---

## Requirements

- Keep only debug backend scenarios that are known to be useful and working:
  - `happy-path`, the baseline scenario used for normal mocked bridge flows.
  - `repro-unindexed-withdrawal-completion`, the documented verified reproduction for locally completed but backend-unindexed completion rows.
- Remove the other speculative or stale scenarios from the scenario list and backend scenario-specific behavior.
- Do not remove generic backend controls/helpers if they still support the kept scenarios, focused unit tests, or future manual wiring.
- Keep debug mode realistic: do not add reproduction hacks or new scenario behavior.

## Test Plan

- BDD.
- RED: update the mock backend scenario test so it asserts the scenario list contains only the kept scenarios.
- GREEN: prune the scenario union and dead scenario branches, update affected tests to use a kept scenario or generic helper behavior, then run the focused mock backend/debug panel tests, lint, typecheck, and the full bridge-ui test suite.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/mock-backend-worker.test.ts` failed before implementation.
- Failure: `exposes only debug backend scenarios that are known to work` expected `["happy-path", "repro-unindexed-withdrawal-completion"]`, but the mock backend still exposed 14 scenarios.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/mock-backend-worker.test.ts` passed: 1 file, 10 tests.
- `moon run -f bridge-ui:test -- test/unit/debug-panel.test.ts` passed: 1 file, 4 tests.
- `moon run bridge-ui:lint` passed: Biome checked 108 files with no errors.
- `moon run bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:test` passed: 27 files, 145 tests.
