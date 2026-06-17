---
id: T374
title: "Key withdrawal finality sets by identity"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:44:17Z
updated_at: 2026-06-17T07:45:35Z
---

## Requirements

- Resolve the Codex review P2 finding in `packages/bridge-sdk/src/withdrawals.ts`.
- The already-finalised guard must not collapse multiple withdrawals that share a transaction hash.
- Key matching witness and committed witness sets by `(transaction hash, aux)` identity.
- Add regression coverage where one same-transaction withdrawal is consumed while a later same-transaction witness is still outside the committed range.

## Test Plan

- TDD.
- RED: add a bridge SDK test for the same-transaction committed/uncommitted witness split that currently reports `alreadyFinalised`.
- GREEN: key the guard sets by full withdrawal identity and rerun focused/full validation plus `codex-review`.

## RED Evidence

- `codex-review --mode branch` reported `[P2] Key committed-witness checks by full withdrawal identity`: hash-only committed witness sets can hide a later same-transaction witness that is outside the committed range.

## GREEN Evidence

- Added bridge SDK regression coverage for a consumed first same-transaction withdrawal plus a later same-transaction witness outside the committed range returning `waiting`, not `alreadyFinalised`.
- Updated the already-finalised guard to key matching, unwitnessed, and committed witness sets by `withdrawalActionIdentity(hash, aux)`.
- `moon run bridge-sdk:test -f` passed with 63 tests.
- `moon run bridge-sdk:test bridge-sdk:typecheck graphql:typecheck actions-api:typecheck -f` passed.
- `git diff --check` passed.
