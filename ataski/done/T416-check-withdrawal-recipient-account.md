---
id: T416
title: "Check withdrawal recipient account"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T21:47:07Z
updated_at: 2026-06-19T21:53:04Z
---

## Requirements

- Fix withdrawal finalization fee gating so the first-withdrawal helper-account minimum is based on the matched withdrawal recipient's L1 account, not the source account used to find withdrawals.
- Preserve the existing helper-account lookup for the source account/token because that controls withdrawal queue progress.
- Cover source/recipient override behavior where the source account has no L1 account but the withdrawal recipient does.

## Test Plan

- TDD: first add a unit test that exercises `fetchWithdrawalFinalizationWitnesses` with a source public key and a different withdrawal recipient, where `fetchAccount` returns no source L1 account but does return a recipient L1 account. The RED expectation is that the pre-fix code returns the insufficient first-withdrawal amount error.

## RED Evidence

- `moon run bridge-sdk:test -f` failed as expected in `withdrawal-finalization-state.test.ts`: the source/recipient override case returned `status: "blocked"` with the first-withdrawal minimum error instead of `available: true`, proving the guard used source account existence instead of the matched withdrawal recipient.

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed: 15 test files, 71 tests. The source/recipient override withdrawal test now returns `available: true`.
