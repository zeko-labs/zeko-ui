---
id: T481
title: "Finalize Ethereum deposits after inner sync"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-07-23T12:47:28Z
updated_at: 2026-07-23T12:47:28Z
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
