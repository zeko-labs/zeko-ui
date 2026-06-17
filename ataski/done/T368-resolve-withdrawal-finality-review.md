---
id: T368
title: "Resolve withdrawal finality review"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T06:40:08Z
updated_at: 2026-06-17T06:44:20Z
---

## Requirements

- Address Gemini review comments on PR #215:
  - Return early from Actions API witness aux queries when the aux input is empty, avoiding unnecessary or invalid `inArray` SQL.
  - Replace repeated O(N*M) withdrawal witness lookup in finalization with a map lookup.
- Address Codex review findings:
  - Do not compare user wallet action states with global inner bridge action states; they are different action streams.
  - Do not compare user-local withdrawal action indexes with global inner indexer/helper indexes.
  - Match user withdrawal actions to inner witness/indexer rows using shared transaction hash plus aux.
- Preserve the false-completed regression behavior: repeated same-recipient/same-amount withdrawals must not be completed by an older same-aux witness.

## Test Plan

- TDD.
- RED: update bridge SDK regression fixtures so wallet action states differ from inner witness action states while transaction hash and aux match; current code should fail because it uses action state equality.
- RED: add Actions API empty-aux query assertions for inner and outer witness lookups.
- GREEN: update backend query guards and SDK matching logic, then rerun focused SDK and Actions API validation plus Codex review.

## RED Evidence

- `moon run bridge-sdk:test -f` failed after updating fixtures so wallet action states differ from inner bridge action states while transaction hash and aux still match:
  - `withdrawal state > normalizes witnessed withdrawal timestamps when the witness timestamp is unresolved` fell back to the provisional wallet action timestamp instead of matching the witness.
  - `null commit state > reports withdrawal finalization as waiting when no outer commit is available` returned `No withdrawal witnesses found` before reaching the commit check.
  - `withdrawal finalization state > does not report already-finalised from an older same-aux witness while a newer action is unresolved` returned `No withdrawal witnesses found`.
- Added Actions API empty-aux tests for inner and outer witness query helpers; local DB execution is blocked until Docker/OrbStack is running.

## GREEN Evidence

- `moon run bridge-sdk:test bridge-sdk:typecheck graphql:typecheck actions-api:typecheck -f` passed.
- `git diff --check` passed.
- `moon run actions-api:test -f` passed as a no-op target.
- `moon run actions-api:manual-db-test -f` remains blocked before assertions because Docker/OrbStack is not running.
