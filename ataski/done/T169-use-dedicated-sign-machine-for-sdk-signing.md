---
id: T169
title: "Use dedicated sign machine for SDK signing"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T18:45:56Z
updated_at: 2026-05-06T18:58:25Z
---

## Requirements

- Revert the transaction-machine changes introduced for SDK sign-only mode.
- Add a separate `signMachine` for wallet-only zkApp signing.
- Update bridge operation flow so SDK transaction signing is represented by explicit XState states after `submitDeposit`, `finalizeDeposit`, `cancelDeposit`, `submitWithdrawal`, and `finalizeWithdrawal`.
- Do not use a Comlink proxy for signing.
- Preserve the existing transaction machine for send-and-confirm flow.

## Test Plan

- TDD: the current implementation is the RED condition because it modified `transactionMachine` for sign-only SDK signing and still hides signing behind a callback.
- Add or update focused tests proving `signMachine` signs without sending.
- GREEN requires bridge UI typecheck and unit tests to pass, plus the pre-commit hook to pass.

## RED Evidence

- Review feedback rejected the transaction-machine sign-only mode and Comlink callback approach; the desired behavior is a dedicated `signMachine` invoked as explicit bridge operation states.

## GREEN Evidence

- `pnpm exec moon run bridge-ui:lint-fix -f` passed.
- `pnpm exec moon run :format-all-fix -f` passed.
- `pnpm exec moon run bridge-ui:test -f` passed: 11 files, 54 tests.
- `pnpm exec moon run bridge-ui:typecheck -f` passed.
