---
id: T173
title: "Normalize SDK executable transactions"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T21:09:13Z
updated_at: 2026-05-06T21:16:54Z
---

## Requirements

- Fix the remaining Bridge UI signing failure where the second `[SIGN] signTransaction` reaches Auro with a non-JSON transaction payload and the wallet reports `SyntaxError: Unexpected non-whitespace character after JSON at position 1`.
- Preserve the architecture: `signMachine` should only ask the wallet to sign proper wallet payloads; the worker should own o1js/SDK transaction normalization.
- Do not introduce a Comlink proxy.
- Do not include unrelated local endpoint edits from `apps/bridge-ui/machines/helpers.ts`.

## Test Plan

- TDD: update the focused sign/worker coverage so opaque SDK/prover strings are not passed directly to the wallet.
- Run the focused regression tests, Bridge UI lint, and Bridge UI typecheck.

## RED Evidence

- `moon run bridge-ui:test -f -- bridge-operation.test.ts` failed as expected. The deposit SDK completion test shows `transactionMachine` is invoked with the SDK completion value `5Juy...`, proving the UI is treating the returned transaction hash as a signable transaction.

## GREEN Evidence

- `moon run bridge-ui:test -f -- bridge-operation.test.ts sign-machine.test.ts metrics-schema.test.ts` passed: 3 files, 8 tests.
- `moon run :format-all-fix -f` passed and formatted 3 files.
- `moon run bridge-ui:lint-fix -f` passed with no fixes applied.
- `moon run bridge-ui:typecheck -f` passed.
