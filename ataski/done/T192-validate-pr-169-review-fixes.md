---
id: T192
title: "Validate PR 169 review fixes"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T19:15:10Z
updated_at: 2026-05-08T19:22:18Z
---

## Requirements

- Validate the PR 169 review findings individually against the current branch.
- Treat reviewer notes as project policy for intentionally pre-1.0 changesets, demoted CLI tests, generated GraphQL formatting, committed alphanet env files, and endpoint selection.
- Apply only low-risk fixes for findings that are valid and do not alter intended bridge behavior.
- Fix SDK signing request lifecycle cleanup so resolved SDK runs without a signature request cannot leak `pendingSdkSignatures`.
- Preserve rejected-signature UI behavior while surfacing unexpected SDK errors to Sentry.
- Remove raw debug console usage where an existing logging path is available.
- Document the CLI o1js signed transaction cast if the cast remains necessary.
- Add targeted automated coverage for the first-withdrawal threshold including bridge proof fee.
- Remove empty `*.manual.test.ts` placeholder files from CLI test collection without reintroducing the old mocked harnesses.
- Update PR metadata so the title/body match the breadth of the branch.

## Test Plan

- DDD: first inspect the current code paths and tests to determine which review findings are valid and non-risky.
- RED evidence should include the current absence of cleanup on successful SDK runs, the exact threshold test gap, raw console calls, the placeholder CLI test files, and the o1js cast without rationale.
- GREEN evidence should include targeted SDK tests and project validation commands for the touched packages.

## RED Evidence

- Inspection confirms `requestSdkSignature` only deletes `pendingSdkSignatures` on rejection or explicit completion/rejection; a successful SDK run that never asks for a signature leaves the map entry alive.
- `rejectSdkSignature` currently swallows every `pending.result` rejection without Sentry capture.
- `operations.worker.ts` has a raw `console.log("Submit Deposit:", ...)`, and `Bridge.pollQuery` uses raw `console.debug("pollQuery", key)` outside the SDK verbose logger helper.
- `packages/bridge-cli/src/core/adapter.ts` still needs an o1js signed-transaction cast with no rationale.
- `packages/bridge-sdk/test/withdrawal-finalization-state.test.ts` covers blocked status with a 2 MINA withdrawal but does not pin the new `l1AccountCreationFee + bridgeProofFee` threshold.
- `packages/bridge-cli/tests/bridge-command.manual.test.ts` and `operation-command.manual.test.ts` are comment-only files matching Vitest collection patterns.

## GREEN Evidence

- Updated `requestSdkSignature` so the SDK run promise owns `pendingSdkSignatures` cleanup in `finally`.
- Updated `rejectSdkSignature` to keep expected signing rejection behavior quiet while capturing unexpected SDK result errors with Sentry.
- Replaced the raw submit-deposit worker log with the existing bridge logger, and routed `pollQuery` through the SDK verbose debug helper.
- Documented the required o1js signed-transaction type assertion in the CLI adapter.
- Added a regression test proving first withdrawals below `l1AccountCreationFee + bridgeProofFee` are blocked when no helper account exists.
- Deleted comment-only CLI `*.manual.test.ts` placeholder files from Vitest collection.
- Updated PR 169 title/body with scoped summary and validation checklist.
- `moon run bridge-sdk:test`: passed, 25 tests.
- `moon run bridge-cli:test`: passed, 63 tests and 13 existing skipped tests.
- `moon run bridge-sdk:typecheck bridge-cli:typecheck bridge-ui:typecheck`: passed.
- `moon run bridge-ui:test`: passed, 61 tests.
- `moon run zeko-skills:test`: passed, 20 tests from cache.
- `moon run :format-all`: passed.
- `moon run :preflight`: not run because no `:preflight` task exists on this branch.
