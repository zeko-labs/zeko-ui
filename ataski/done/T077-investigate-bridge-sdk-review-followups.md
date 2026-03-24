---
id: T077
title: "Investigate and fix bridge-sdk review followups"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T17:27:35Z
updated_at: 2026-03-11T17:31:42Z
---

## Requirements

- Validate the current PR review findings that affect `packages/bridge-sdk`, including the additional findings provided in the thread.
- Implement fixes only for findings that are real issues in the current branch. Skip cosmetic or informational comments unless they hide a real bug.
- At minimum, evaluate the diagnostics truthiness checks, the typo in the payload error label, and whether any duplication or performance comments warrant code changes.
- Keep the operator diagnostic entrypoint behavior stable unless a validated bug requires a targeted adjustment.

## Test Plan

- DDD
- Add or update focused bridge-sdk tests for any validated bug fixes, especially the diagnostics field-parsing cases if zero-valued fields can currently be misclassified.
- Re-run `moon run bridge-sdk:test -f` and `moon run bridge-sdk:typecheck -f`.
- Record only the GREEN evidence for the issues that actually resulted in code changes.

## RED Evidence

## Test Strategy Exception

These followups are a mix of real bugs, latent risks, and informational comments. The task will validate each finding against the current code first, then add or run targeted coverage only for the subset that requires a code change.

## GREEN Evidence

- Validated and fixed:
  - `packages/bridge-sdk/src/utils.ts`: corrected the error label typo to `Invalid commit ASE past withdrawal delay data`.
- Investigated and rejected:
  - `Field(0)` falsiness claim is false in the current runtime; `Field(0)` is truthy, so the diagnostics truthiness checks are not filtering zero-valued fields for that reason.
  - The duplicated parsing logic and full-fetch promotion comments are code-quality/performance notes, not current bugs.
- `moon run bridge-sdk:test -f`
  - Passed: 1 file, 4 tests.
- `moon run bridge-sdk:typecheck -f`
  - Passed.
