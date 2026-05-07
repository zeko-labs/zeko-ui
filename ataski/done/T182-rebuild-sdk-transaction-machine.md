---
id: T182
title: "Rebuild SDK transaction machine"
status: done
blockedBy: []
owner: Codex
created_at: 2026-05-07T02:00:48Z
updated_at: 2026-05-07T02:14:40Z
---

## Requirements

- Replace the standalone `signMachine` with a single `transactionMachine` that owns SDK transaction request creation, wallet signing, SDK signature completion, low-fee retry, and final hash output.
- Keep obsolete pieces removed: no `hashDb`, no direct UI `sendZkAppCommand` path, no wait-for-inclusion state, and no `send_and_confirm` bridge operation states.
- On `"Fee is too low"` completion failures, retry by creating a fresh SDK transaction request with a doubled fee before asking the wallet to sign again. Do not mutate an already signed transaction.
- Preserve wallet rejection and unsupported-wallet error handling from the current signing path.
- Simplify `bridgeOperationMachine` so each submit/finalize/cancel state invokes the transaction machine instead of repeating transaction/sign substates.
- Restore fee retry observability for the new lifecycle using the transaction machine category/action.
- Add or update meaningful unit tests for retry behavior, wallet signing behavior, and bridge operation integration.

## Test Plan

- TDD: first add tests that fail because the current SDK signing path does not retry a low-fee completion failure and because `bridgeOperationMachine` still invokes `signMachine` directly.

## RED Evidence

- `moon run bridge-ui:test -f -- test/unit/transaction-machine.test.ts` fails because `../../machines/transaction` cannot be resolved. This captures the intended replacement before implementation: the bridge UI needs a transaction machine that signs SDK requests, completes them, and retries low-fee completion failures by rebuilding and re-signing.

## GREEN Evidence

- Added `apps/bridge-ui/machines/transaction.ts` as the single SDK transaction state machine. It creates SDK signature requests, signs through the wallet, completes SDK signatures, retries low-fee completion failures by rebuilding with doubled fees, and returns final explorer results.
- Deleted the standalone `signMachine` and its unit test. Signing behavior now lives inside the transaction machine.
- Updated `bridgeOperationMachine` to invoke `transactionMachine` for submit/finalize/cancel operations instead of repeating transaction/sign substates.
- Added fee override plumbing through `operations.worker.ts`, `packages/bridge-sdk`, and `bridge-cli` finalizer/cancel retry paths.
- Restored transaction/fee retry observability docs, SQL, Grafana manifest, and generated dashboard output for the new transaction machine.
- `moon run bridge-ui:test -f -- test/unit/transaction-machine.test.ts` passed.
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts test/unit/metrics-schema.test.ts` passed.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:test -f` passed.
- `moon run bridge-cli:test -f` passed.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-sdk:test -f` passed.
- `moon run bridge-ui:metrics-report -f` passed in dry-run mode.
- `moon run bridge-ui:lint -f` and `moon run bridge-cli:lint -f` passed.
- `moon run bridge-sdk:lint -f` completed with the pre-existing `src/types.ts` `noExplicitAny` warnings only.
- `git diff --check` passed.
