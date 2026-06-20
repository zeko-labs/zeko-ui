---
id: T415
title: "Preserve withdrawal helper APIs"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T21:31:41Z
updated_at: 2026-06-19T21:35:08Z
---

## Requirements

- Keep the new first-withdrawal fee checks for missing helper and recipient accounts.
- Preserve patch-release TypeScript compatibility for exported `assertFirstWithdrawalAmountCanCreateHelper`, `ensureFirstWithdrawalAmountCanCreateHelper`, and `InsufficientFirstWithdrawalAmountError` constructor inputs.
- Existing consumers that pass the previous helper input shape must still compile and behave as before.
- The newer bridge code must still pass explicit recipient-account and proof-fee inputs.

## Test Plan

- TDD: add a type-aware regression test that calls the exported helpers with their previous input shape using `satisfies Parameters<typeof helper>[0]`, then run a direct `tsgo --noEmit` command against that test file. RED should fail because the new fields are currently required.
- GREEN: make the new fields optional with backward-compatible defaults and rerun bridge-sdk tests/typecheck plus affected validator checks.

## RED Evidence

- `pnpm exec tsgo --ignoreConfig --noEmit --declaration false --declarationMap false --target ES2020 --module esnext --moduleResolution bundler --strict --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports packages/bridge-sdk/test/errors.test.ts` failed as expected. The old helper input shapes were missing `recipientAccountExists`/`bridgeProofFee`, and the old `accountCreationFeeNanomina` error-constructor field was rejected.

## GREEN Evidence

- `pnpm exec tsgo --ignoreConfig --noEmit --declaration false --declarationMap false --target ES2020 --module esnext --moduleResolution bundler --strict --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports packages/bridge-sdk/test/errors.test.ts` passed.
- `moon run bridge-sdk:test bridge-sdk:typecheck bridge-sdk:lint bridge-sdk:build -f` passed with 69 tests plus typecheck, lint, and build.
- `moon run bridge-cli:test bridge-cli:typecheck bridge-cli:lint bridge-cli:build -f` passed with 128 tests, 13 skipped, plus typecheck, lint, and build.
- `git diff --check` passed.
