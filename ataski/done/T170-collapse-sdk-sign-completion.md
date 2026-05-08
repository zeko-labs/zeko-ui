---
id: T170
title: "Collapse SDK sign completion"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T19:22:07Z
updated_at: 2026-05-06T19:27:16Z
---

## Requirements

- Verify the bridge operation actors still preserve their original operation inputs and error behavior after the signing refactor.
- Move SDK signature completion into `signMachine` so bridge operation states do not need separate `complete` substates.
- Keep `transactionMachine` send-and-confirm only and keep SDK signing free of Comlink proxy callbacks.
- Simplify `operations.worker` pending signature plumbing where possible without losing the async boundary required by the Bridge SDK signing callback.

## Test Plan

- DDD: compare the operation actor changes against the previous implementation to identify accidental deletions before editing.
- Update focused tests to cover the merged sign-and-complete flow.
- GREEN requires bridge UI lint, tests, and typecheck to pass, plus the pre-commit hook to pass.

## RED Evidence

- The current bridge operation machine has separate `sign` and `complete` states for each SDK operation, and `requestSdkSignature` carries unnecessary bookkeeping around whether the request has been emitted.

## GREEN Evidence

- Verified the operation actors still call the same worker methods with the original `l1`, `l2`, `user`, `amount`, and `timeoutSlots` inputs where applicable.
- `pnpm exec moon run :format-all-fix -f` passed.
- `pnpm exec moon run bridge-ui:lint-fix -f` passed.
- `pnpm exec moon run bridge-ui:typecheck -f` passed.
- `pnpm exec moon run bridge-ui:test -f` passed: 11 files, 55 tests.
