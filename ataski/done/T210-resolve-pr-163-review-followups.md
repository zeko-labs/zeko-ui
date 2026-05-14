---
id: T210
title: "Resolve PR 163 review followups"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-14T07:30:24Z
updated_at: 2026-05-14T07:36:03Z
---

## Requirements

- Add a regression test for the bridge CLI deposit flow where `canFinalizeDeposit()` reports an SDK-selected effective claim index while local deposit status does not expose a raw `claimableIndex`; the flow must not submit duplicate finalization transactions while status lags after the first finalization hash.
- Fix the deposit finalization runner so the effective claim index selected by the decision layer is preserved through the finalize step for `pendingFinalizeIndex`, `finalTransaction`, and logging.
- Review Copilot/Gemini/Devin/Sentry PR comments on PR 163 and validate each finding:
  - lost effective deposit claim index: fix if reproduced.
  - direct `deposit submit` recoverable mutation retries: avoid an unbounded silent retry loop if the backend keeps returning recoverable errors.
  - withdrawal already-finalised index fallback: avoid leaking invalid indexes such as `-Infinity`.
  - Gemini concise helper style note: apply only if it improves clarity without hiding the branch intent.
- Keep changes scoped to bridge CLI/SDK behavior and tests.

## Test Plan

- BDD: first add a failing bridge CLI behavior test that models SDK-selected deposit finalization while local status flags lag, and record the RED failure.
- TDD: add or update focused tests for direct recoverable mutation retry exhaustion and withdrawal already-finalised index fallback if those comments are validated as real defects.
- GREEN: implement minimal runtime fixes, then run focused package tests with Moon.

## RED Evidence

- `moon run bridge-cli:test -f` failed after adding the regression tests:
  - `bridge flow > does not resubmit SDK-selected prior deposit finalization while status lags` failed with `expected 2 to be 1`, proving the prior deposit finalization was submitted twice.
  - The run was interrupted after the bridge failure because the new direct retry-budget test intentionally exposed the existing unbounded recoverable mutation retry loop.

## GREEN Evidence

- Fixed the bridge CLI deposit runner to carry `effectiveClaimableIndex` from `decideDepositStep()` into `runFinalizeDepositStep()`.
- Added regression coverage for SDK-selected prior deposit finalization while status lags; it now completes with one finalization submission.
- Added direct deposit submit retry-budget coverage; persistent recoverable mutation failures now stop after 10 attempts with the original backend error included.
- Reviewed PR bot comments:
  - Devin/Sentry/Gemini effective-index finding: valid and fixed.
  - Copilot direct retry loop finding: valid and fixed with a bounded retry budget.
  - Copilot withdrawal `-Infinity` fallback finding: not valid against the current branch conditions; existing tests cover both already-finalised paths, and no SDK code change was needed.
  - Gemini concise helper style note: skipped; the explicit branch form is clearer for this domain condition.
- `moon run bridge-cli:test -f` passed: 21 files, 104 tests passed, 13 skipped.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:lint -f` passed.
- `moon run bridge-cli:build -f` passed.
- `git diff --check` passed.
