---
id: T372
title: "Preserve outer actions tail from final anchor"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:29:00Z
updated_at: 2026-06-17T07:31:00Z
---

## Requirements

- Resolve the Codex review P2 finding in `services/actions/api/src/schema/outer.ts`.
- `queryOuterActions` must return a pending outer tail when `beforeState` is the `afterState` of the latest final outer action and the next row is pending.
- Keep final-only constraints for witness evidence and final commit anchors; only relax the range start lookup needed for live outer state reconstruction.
- Add focused Actions API regression coverage for querying from a final outer action state into a pending tail.

## Test Plan

- TDD.
- RED: use the Codex review finding as failing behavioral evidence, then add a DB-backed `queryOuterActions` regression that expects the pending tail from final anchor `a3`.
- GREEN: relax the outer range start lookup and rerun available focused validation.

## RED Evidence

- `codex-review --mode branch` reported `[P2] Preserve pending tail from a final outer anchor`: `queryOuterActions` looked up the start row with `markedAsCanonicalAt IS NOT NULL`, so `beforeState` equal to the latest final action state returned no pending tail rows.

## GREEN Evidence

- Added regression coverage in `services/actions/api/tests/actions.test.ts` for `queryOuterActions(testDb, { beforeState: "a3" })` returning the pending `a4-pending` tail.
- `moon run bridge-sdk:test bridge-sdk:typecheck graphql:typecheck actions-api:typecheck -f` passed, including 60 bridge SDK tests.
- `git diff --check` passed.
- `moon run actions-api:manual-db-test -f` remains blocked before assertions because Docker/OrbStack is not running.
