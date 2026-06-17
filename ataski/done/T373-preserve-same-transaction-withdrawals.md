---
id: T373
title: "Preserve same transaction withdrawals"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:35:28Z
updated_at: 2026-06-17T07:37:50Z
---

## Requirements

- Resolve the Codex review P2 finding in `packages/bridge-sdk/src/withdrawals.ts`.
- Withdrawal matching must preserve multiple withdrawal actions that share the same transaction hash.
- Match witness rows to wallet withdrawal actions by the full transaction hash plus aux identity instead of allowing a hash-only map to overwrite earlier same-transaction withdrawals.
- Add focused bridge SDK regression coverage for two withdrawals from one transaction with different aux values.

## Test Plan

- TDD.
- RED: add a bridge SDK regression that fails when a hash-only map drops the first same-transaction withdrawal.
- GREEN: update withdrawal lookups to preserve same-hash candidates and rerun focused/full validation plus `codex-review`.

## RED Evidence

- `codex-review --mode branch` reported `[P2] Preserve multiple withdrawals per transaction`: a `Map` keyed only by transaction hash keeps only the last action for that hash and can drop earlier withdrawals from the same transaction.

## GREEN Evidence

- Added bridge SDK regression coverage for `canFinalizeWithdrawal` when two withdrawals share `shared-withdrawal-tx` and the first one has the available witness.
- Added bridge SDK regression coverage for `fetchWithdrawalsWithStates` preserving both witnessed withdrawals when they share the same transaction hash with different aux values.
- `moon run bridge-sdk:test -f` passed with 62 tests.
- `moon run bridge-sdk:test bridge-sdk:typecheck graphql:typecheck actions-api:typecheck -f` passed.
- `git diff --check` passed.
