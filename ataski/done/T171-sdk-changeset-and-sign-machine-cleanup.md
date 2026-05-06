---
id: T171
title: "SDK changeset and sign machine cleanup"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T19:55:19Z
updated_at: 2026-05-06T19:56:28Z
---

## Requirements

- Add a minor changeset for the bridge SDK breaking API shape introduced from the pay-for-bridge branch.
- Remove unnecessary routing from `signMachine`.
- Re-check the signing flow soundness and document the worker/signing responsibilities in the handoff.

## Test Plan

- DDD: inspect SDK call sites and worker/UI transaction flow to verify whether two signatures are intentional.
- Run bridge UI lint, typecheck, and tests after the state-machine cleanup.

## RED Evidence

- `signMachine` currently uses a separate `ROUTING` state where direct `onDone` branching is enough.
- No changeset currently describes the breaking SDK signing callback/API shape change from this PR.

## GREEN Evidence

- Confirmed SDK methods use `signTxn(txn)` to extract signed account updates/signatures for prover GraphQL requests, then return `pollQuery(...).executed` for the later send-and-confirm flow.
- `pnpm exec moon run :format-all-fix -f` passed.
- `pnpm exec moon run bridge-ui:lint-fix -f` passed.
- `pnpm exec moon run bridge-ui:typecheck -f` passed.
- `pnpm exec moon run bridge-ui:test -f` passed: 11 files, 55 tests.
