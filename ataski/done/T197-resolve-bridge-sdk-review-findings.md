---
id: T197
title: "Resolve bridge SDK review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T03:52:36Z
updated_at: 2026-05-13T04:02:34Z
---

## Requirements

- Validate PR #174 review findings from Gemini and Copilot.
- Apply valid review fixes for bridge SDK withdrawal live-action fallback behavior.
- Keep unknown live cursor detection robust for `Error` instances and raw GraphQL error-like objects with a `message` property.
- Remove the incremental live action `.slice(1)` assumption and rely on `afterActionState` merge dedupe instead.
- Add a patch changeset for `@zeko-labs/bridge-sdk`.
- Re-run relevant automated validation and update the PR branch.

## Test Plan

- TDD: first update the regression coverage so it fails against the current implementation for raw GraphQL error objects and non-leading duplicate live cursor actions.
- RED path: run the focused bridge SDK unit test and record the failure before implementation edits.
- GREEN path: implement the review fixes, add the changeset, then run bridge SDK tests/typecheck/lint and bridge UI typecheck through Moon.

## RED Evidence

- `pnpm exec vitest run test/withdrawal-finalization-state.test.ts` failed as expected after updating review-finding coverage:
  - raw GraphQL error object case still rejected with `from 4474967054315016516812122185988395396069982311953508365013897653982583369647 not found`
  - incremental live actions with the duplicate cursor action not first returned only `["201"]` instead of `["201", "202"]`

## GREEN Evidence

- `pnpm exec vitest run test/withdrawal-finalization-state.test.ts`: passed 6 tests, including raw GraphQL error object handling and order-independent incremental live action dedupe.
- `moon run -f bridge-sdk:test`: passed 26 tests across 4 automated bridge SDK test files.
- `moon run -f bridge-sdk:typecheck`: passed.
- `moon run -f bridge-sdk:lint`: passed with pre-existing warnings in `src/types.ts` for `ExtractInput<T>` using `any`.
- `moon run -f bridge-ui:typecheck`: passed.
- Added `.changeset/soft-cursors-smile.md` as a patch changeset for `@zeko-labs/bridge-sdk`.
