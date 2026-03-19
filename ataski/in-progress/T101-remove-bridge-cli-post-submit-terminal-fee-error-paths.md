---
id: T101
title: "Remove bridge-cli post-submit terminal fee-error paths"
status: in-progress
blockedBy: []
owner: codex-cli-worker
created_at: 2026-03-19T00:00:00Z
updated_at: 2026-03-19T00:00:00Z
---
## Requirements

- Scope is only the first-withdrawal fee error handling in `packages/bridge-cli`.
- Keep the shared fee error surfaced from `submitWithdrawal`, whether the source is:
  - local SDK precheck
  - backend/sequencer submit failure
- Remove post-submit special handling for this error:
  - remove retry/capability special-casing tied to `canFinalizeWithdrawal`
  - do not rely on capability/finalize stages to detect this error
- Ensure a failed withdrawal submit does not continue into inspect, wait, or finalize steps.
- Replace the existing bridge-flow test coverage that expects the fee error from `canFinalizeWithdrawal` with submit-phase coverage for both local/backend sources.

## Test Plan

- DDD. First identify the current CLI paths and tests that special-case this error after submission.
- Then move the assertion point to submission and add regression coverage for:
  - immediate submit failure
  - no transition into capability/finalize polling
  - unchanged human/JSON error output for the shared fee error
- Validate with:
  - `moon bridge-cli:test`
  - `moon bridge-cli:typecheck`

## RED Evidence

## GREEN Evidence
