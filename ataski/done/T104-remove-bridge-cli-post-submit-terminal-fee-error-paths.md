---
id: T104
title: "Remove bridge-cli post-submit terminal fee-error paths"
status: done
blockedBy: []
owner: codex-cli-worker
created_at: 2026-03-19T00:00:00Z
updated_at: 2026-03-19T11:37:46Z
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

- Confirmed the CLI still special-cased this fee error after submission by treating capability inspection as terminal in `packages/bridge-cli/src/commands/bridge.ts`, with matching coverage in `packages/bridge-cli/tests/bridge-flow.test.ts`.

## GREEN Evidence

- Removed the post-submit capability retry special-casing from `packages/bridge-cli/src/commands/bridge.ts` so the fee error is surfaced only from the submit step.
- Replaced the capability-stage regression with submit-stage coverage for both local and backend-originated fee failures in `packages/bridge-cli/tests/bridge-flow.test.ts`.
- `moon run bridge-cli:test` passed on the canonical branch with 17 test files and 83 tests passing after syncing the latest `canonical/bridge-cli`.
- `moon run bridge-cli:typecheck` passed on the canonical branch.
