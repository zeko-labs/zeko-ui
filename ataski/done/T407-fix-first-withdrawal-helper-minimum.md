---
id: T407
title: "Fix first withdrawal helper minimum"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T13:34:05Z
updated_at: 2026-06-19T15:45:05Z
---

## Requirements

- Fix the Bridge SDK first-withdrawal amount guard so a brand-new L1 helper account cannot submit a withdrawal amount that later produces a finalization transaction with zero or insufficient recipient payout.
- The guard must account for the L1 helper account creation fee, the bridge proof fee paid on finalization, and a positive recipient payout amount large enough to create the recipient payout account when needed.
- Update the user-facing insufficient amount error so it explains the full first-withdrawal minimum instead of only mentioning Mina account creation.
- Keep the change scoped to withdrawal amount validation and the operator runbook text that describes fresh-wallet withdrawal funding.

## Test Plan

- TDD: first add focused Bridge SDK tests that fail with the current `1.2 MINA` minimum by proving a first withdrawal equal to `l1AccountCreationFee + bridgeProofFee` is rejected when the helper account does not exist.
- Add a complementary passing-edge test for the new minimum.
- Then update the SDK guard and runbook until the focused tests pass.

## RED Evidence

- `moon run bridge-sdk:test -f -- test/withdrawal-finalization-state.test.ts` failed before implementation. New regression `blocks first withdrawals that would leave no helper-recipient payout` expected `available=false` with a `2.5 MINA` minimum, but current code returned `available=true`.

## GREEN Evidence

- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-sdk:test -f -- test/withdrawal-finalization-state.test.ts test/errors.test.ts` passed: 15 files, 67 tests.
- Local CLI resume of existing withdrawal operation `c83028f1-deef-4cef-82c6-1eb91e70d7c8` completed after the recipient default L1 account existed and helper account was still missing. Final transaction: `5JuQcGsHJ5Rsz1iwFn1xGPAQFHHkRwGaJ1njGVQf66NWrhKtzPC7`.
- Direct L1 verification after finalization showed helper-token account exists for `B62qoPnxgyPTSCVTiNXgpWVbzQAZUGhjXFgFRHvTW5WHQrc8nrkeydA` with helper token state `zkappState[1] = 10611`, proving the first-helper-account withdrawal path succeeded.
