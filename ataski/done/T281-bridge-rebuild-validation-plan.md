---
id: T281
title: "Bridge rebuild validation plan"
status: done
blockedBy: [T280]
owner: codex
created_at: 2026-06-08T16:52:07Z
updated_at: 2026-06-08T17:07:00Z
---

## Requirements

- Determine whether the current production/testnet Actions API database requires a full rebuild/reset from archive after the code fix.
- Do not deploy, reset, or mutate live infrastructure before PR review.
- Document the reviewed operator sequence needed after merge: deploy fixed indexer, rebuild/reset the affected DB from archive, verify dense action indexes, then validate bridge SDK finalization witnesses.
- Include the bridge SDK validation criterion: `witness.index + 1` must match the real action-state length expected by the finalize-deposit circuit.

## Test Plan

- DDD: Use the confirmed DB state and the implemented invariant checks to reason about repair requirements. Record non-mutating validation commands and expected post-rebuild checks.

## RED Evidence

- Existing DB rows already contain sparse protocol indexes. Code changes that only affect future inserts cannot make current `outer_actions.index` dense again.
- A direct deploy/reset/rebuild was intentionally not performed before PR review.

## GREEN Evidence

- Determination: the affected production/testnet Actions API database needs a full rebuild/reset from archive after the fixed indexer is reviewed and deployed. The persisted sparse `outer_actions.index` values are protocol witness inputs, so code-only changes cannot repair existing rows.
- Safe post-review sequence:
  - Deploy the reviewed indexer fix first, so conflicts fail fast during rebuild.
  - Stop or pause user-facing bridge finalization if needed while rebuilding the affected Actions DB.
  - Run the reviewed indexer rebuild/reset path against the affected environment. Do not hand-edit action indexes.
  - Run a read-only integrity check over `outer_actions` and `inner_actions`: `count == max(index) - min(index) + 1`, `firstMissingIndex == null`, and `linkedGapCount == 0`.
  - Validate the bridge SDK deposit-finalization path against rebuilt Actions API data: for the failing deposit region, the witness index returned by `outerWitnessesFromAuxes` must satisfy `witness.index + 1 == real action-state length` expected by the finalize-deposit circuit.
  - Only then retry `finalizeDeposit`.
- No deploy, reset, rebuild, or live DB mutation was performed before PR review.
