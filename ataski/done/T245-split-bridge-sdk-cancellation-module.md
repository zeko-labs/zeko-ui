---
id: T245
title: "split-bridge-sdk-cancellation-module"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-08T23:09:29Z
updated_at: 2026-05-08T23:18:30Z
---

## Requirements

- Move deposit cancellation behavior out of `packages/bridge-sdk/src/deposits.ts` into its own bridge-sdk source module.
- Keep the public `Bridge` facade API compatible: `cancelDeposit`, `canCancelDeposit`, deposit state reads, finalization, and transaction construction must remain callable with the same runtime object shape.
- Preserve existing cancellation semantics, including witness selection, cancellability checks, and finalization filtering for rejected cancellable deposits.
- Apply the Gemini review fixes on PR #171:
  - avoid lossy numeric conversion when incrementing accepted deposit indexes;
  - route prover polling debug output through the runtime-aware debug helper instead of calling `console.debug` directly.
- Do not add new runtime dependencies or broaden the bridge-sdk public package export surface.

## Test Plan

- TDD for the prover logging fix: add a focused bridge-sdk test that fails while `pollProvingResult` calls `console.debug` directly when `runtime.verbose` is false.
- Characterization validation for the cancellation module split: run the existing bridge-sdk deposit cancellation/finalization tests that exercise `cancelDeposit`, `canCancelDeposit`, rejected-deposit filtering, and facade compatibility.
- Run bridge-sdk typecheck and build so internal module boundaries are validated by TypeScript and package output generation.

## RED Evidence

- `moon run bridge-sdk:test -f -- test/prover.test.ts` failed before implementation changes.
- New failure: `test/prover.test.ts` proves `pollProvingResult` still calls `console.debug("pollQuery", key)` when `runtime.config.verbose` is false.
- Existing characterization failures in the same run: `deposit-cancellation.test.ts` showed `bridgeInternals.fetchDepositFinalizationWitnesses is not a function`, so the refactor must restore that private compatibility hook while preserving the public facade.

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed: 6 files, 26 tests, including the new prover regression test and existing deposit cancellation/finalization characterization tests.
- `moon run bridge-sdk:typecheck -f` passed after restoring the internal finalization witness hook.
- `moon run bridge-sdk:build -f` passed.
- `moon run bridge-sdk:lint -f` passed with only the pre-existing `ExtractInput<any>` warnings in `packages/bridge-sdk/src/types.ts`.
