---
id: T481
title: "Finalize Ethereum deposits after inner sync"
status: done
blockedBy: []
owner: codex
created_at: 2026-07-23T12:47:28Z
updated_at: 2026-07-23T13:30:18Z
---

## Requirements

- Add a separate Ethereum-only deposit-finalization function to the Bridge SDK;
  do not change the existing Mina `canFinalizeDeposit` or `finalizeDeposit`
  behavior.
- Make a canonical Ethereum deposit finalizable as soon as its exact outer
  witness action is covered by the inner account's synchronized outer action
  state, without requiring a later commit or comparing the deposit timeout.
- Submit the Ethereum-specific GraphQL mutation and witness shape required by
  the separate Zeko circuit.
- Route the Ethereum Bridge SDK client through the new function while preserving
  its existing public deposit-finalization interface.
- Keep pending and canonical indexed outer actions available to this path and
  cover each case separately.
- Keep finalization ordering, duplicate-prevention helper state, recipient
  payout, proof fee, and retry-on-inner-state-change behavior unchanged.
- Add release changesets for every modified publishable package.

## Test Plan

- TDD.
- RED: add Bridge SDK tests proving that a synchronized Ethereum deposit is
  immediately finalizable with no commit, that an unsynchronized deposit is
  not, and that pending and canonical indexed witnesses are each accepted.
- RED: add Ethereum Bridge SDK coverage proving its client calls the new
  Ethereum-only Bridge function rather than the Mina finalization function.
- GREEN: implement the dedicated witness builder/finalizer and GraphQL document,
  then run the focused Bridge SDK, Ethereum Bridge SDK, and GraphQL package
  tests/typechecks/lints/builds through Moon.
- Regression: run the existing Mina deposit-finalization tests unchanged.

## Implementation

- Added an Ethereum-only witness builder and finalizer that starts from the
  exact deposit action state and extends it to the inner account's synchronized
  outer-action state.
- Added the `finalizeEthereumDeposit` GraphQL mutation and routed the Ethereum
  Bridge SDK's existing public finalization methods through the dedicated
  Bridge SDK methods.
- Left the Mina commit/timeout-based finalization path unchanged.
- Added patch changesets for `@zeko-labs/bridge-sdk`,
  `@zeko-labs/eth-bridge-sdk`, and `@zeko-labs/graphql`.

## Validation

- TDD RED was captured before implementation: the new Ethereum-only method was
  absent while the existing Bridge SDK suite remained green.
- `moon run graphql:typecheck bridge-sdk:typecheck eth-bridge-sdk:typecheck
  bridge-sdk:test eth-bridge-sdk:test` passed.
- Bridge SDK: 18 files and 80 tests passed, including pending, canonical,
  unsynchronized, and cancellation-cursor coverage.
- Ethereum Bridge SDK: 3 files and 10 tests passed, including dedicated-method
  routing.
- Package lint, formatting, and builds passed; the unchanged Mina deposit
  finalization regression tests remain green.
