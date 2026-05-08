---
id: T181
title: "Remove obsolete bridge transaction machine"
status: done
blockedBy: []
owner: Codex
created_at: 2026-05-07T01:22:27Z
updated_at: 2026-05-07T01:27:40Z
---

## Requirements

- Remove dead bridge UI code for the old UI-managed transaction broadcast path.
- Delete `transactionMachine` and its `hashDb` resume cache, because the active SDK flow now submits through `completeSdkSignature`.
- Remove `send_and_confirm` bridge operation substates and their UI rendering branches.
- Preserve the active SDK signature flow: SDK request creation, wallet signing, SDK completion, returned hash/result display.
- Do not alter unrelated endpoint configuration changes in `machines/helpers.ts`.

## Test Plan

- DDD: remove the obsolete modules and run bridge UI unit tests, typecheck, lint, and whitespace validation.

## RED Evidence

- Dead code audit: `transactionMachine`, `hashDb`, and all `send_and_confirm` substates are only reachable from the obsolete bridge operation states that are no longer transitioned to by the SDK-backed signing flow.

## GREEN Evidence

- Removed the `transactionMachine` module and the `hashDb` IndexedDB resume cache.
- Removed now-unused `idb` and `ohash` bridge UI dependencies and refreshed `pnpm-lock.yaml`.
- Removed all bridge operation `send_and_confirm` substates and matching `CurrentOperation` render branches.
- Removed obsolete hash DB tests and transaction-machine observability queries/panels.
- `rg "hashDb|HashDb|createDb|SavedTransaction|transactionMachine|send_and_confirm|findUnconfirmedTransaction|saveSigned|confirmTransaction|sendAndConfirm|machines/transaction|feeRetry|blob1 = 'transaction'|\\[TRANSACTION\\]" apps/bridge-ui -n` returns no matches.
- `moon run bridge-ui:test -f -- test/unit/bridge-operation.test.ts test/unit/bridge-view-model.test.ts test/unit/metrics-schema.test.ts` passed (9 tests).
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:test -f` passed (12 files, 56 tests).
- `moon run bridge-ui:lint -f` passed.
- `git diff --check` passed.
