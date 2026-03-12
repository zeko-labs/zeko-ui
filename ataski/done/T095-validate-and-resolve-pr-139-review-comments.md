---
id: T095
title: "Validate and resolve PR 139 review comments"
status: done
blockedBy: [T094]
owner: codex
created_at: 2026-03-12T15:40:00Z
updated_at: 2026-03-12T16:45:00Z
---

## Requirements

- Pull all active GitHub review threads for PR #139 after the validator scope split is complete.
- For each review comment, verify whether the finding is real against the current code rather than applying suggestions blindly.
- Fix every legitimate finding on the canonical branch with tests where behavior changes.
- Resolve each GitHub conversation appropriately:
  - fix + resolve for legitimate findings
  - resolve as outdated when the comment no longer applies after later changes
  - leave a concise explanation only when a finding is not valid
- Record the review-thread outcomes and validation evidence in GREEN evidence.

## Test Plan

- DDD. First enumerate all live review threads and classify them as valid, outdated, or invalid against the current tree.
- For valid findings, reproduce with focused tests or concrete code-path inspection before changing code.
- Re-run the affected package gates after fixes, then resolve the corresponding GitHub threads.

## RED Evidence

- `gh api graphql ... pullRequest(number:139) { reviewThreads { ... } }` returns multiple unresolved review threads on PR #139 across `bridge-cli`, `bridge-sdk`, and related files.
- Current unresolved thread set includes:
  - valid-looking behavioral findings around recipient handling, finalization account selection, GraphQL error swallowing, and submit-state failure transitions
  - style/refactor suggestions that need validation against the current branch before changing code

## GREEN Evidence

- Fixed legitimate recipient-routing bugs on the canonical branch:
  - `packages/bridge-cli/src/core/adapter.ts` now accepts and forwards `recipient` for deposit and withdrawal submission, deriving the fallback recipient on `route.to`.
  - `packages/bridge-cli/src/commands/bridge.ts` now passes `session.recipient` into submit steps and defaults the high-level bridge recipient from the destination signer.
- Fixed legitimate failure-propagation bugs:
  - `packages/bridge-cli/src/commands/bridge.ts` now guards `submitDeposit` / `submitWithdrawal` `onDone` transitions so `{ next: "failed" }` reaches the `failed` state instead of falling through into inspect.
  - `packages/bridge-sdk/src/utils.ts` now throws GraphQL query errors from `fetchActions` instead of silently returning `[]`.
  - `packages/bridge-cli/src/commands/operation.ts` now fails fast on non-retryable adapter initialization errors (for example missing signer keys) while preserving unattended retries for transient backend initialization failures.
- Added focused regression coverage:
  - `packages/bridge-cli/tests/bridge-command.test.ts`
  - `packages/bridge-cli/tests/bridge-flow.test.ts`
  - `packages/bridge-cli/tests/operation-command.test.ts`
  - `packages/bridge-sdk/test/diagnostics.test.ts`
- Validation after fixes:
  - `moon run bridge-cli:test bridge-cli:typecheck bridge-cli:lint bridge-cli:build`
  - `moon run bridge-sdk:test bridge-sdk:typecheck`
- Thread triage outcome on PR #139:
  - fix + resolve: recipient wiring, destination-recipient derivation, GraphQL error swallowing, submit-state failure transition, non-retryable adapter init retry loop
  - resolve outdated: validator-scope comments and comments superseded by later code changes
  - resolve with explanation: explicit infinite waits in unattended bridge polling remain intentional; declaration-build constraints require explicit command return types
