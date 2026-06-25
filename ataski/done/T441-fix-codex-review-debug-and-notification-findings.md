---
id: T441
title: "Fix Codex review debug and notification findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T13:06:54Z
updated_at: 2026-06-25T13:12:29Z
---

## Requirements

- Address Codex review P2: the `repro-first-withdrawal-too-small` mock backend scenario must only throw the first-withdrawal-too-small backend error for pending withdrawals below the 2.2 MINA threshold.
- Valid pending withdrawals at or above 2.2 MINA must remain finalizable in the debug scenario, matching the production SDK amount gate instead of inventing a debug-only failure.
- Address Codex review P3: missing service-worker registration must remain observable outside local/mock verification contexts.
- Local/mock verification may stay quiet for expected no-service-worker noise, but production-like notification dispatch must surface a missing service-worker registration as an error instead of silently returning.

## Test Plan

- BDD.
- RED: add failing mock-backend coverage proving a 2.2 MINA withdrawal does not fail in `repro-first-withdrawal-too-small`, and notification coverage proving missing service-worker registration rejects outside local/mock verification contexts.
- GREEN: gate the mock failure by amount and make notification dispatch suppress missing-registration noise only in mock debug mode or on local hostnames.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/notifications.test.ts` failed as expected:
  - `does not invent a first withdrawal threshold error for valid amounts` rejected with the first-withdrawal-too-small error for a `2.2` MINA seeded withdrawal.
  - `rejects when no service worker is registered outside quiet verification contexts` resolved `undefined` instead of rejecting with `No service worker registration found.`

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/mock-backend-worker.test.ts test/unit/notifications.test.ts` passed: 2 files, 17 tests.
- `moon run -f bridge-ui:format-fix` passed.
- `moon run -f bridge-ui:test` passed: 31 files, 177 tests.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:lint` passed.
- `git diff --check` passed.
