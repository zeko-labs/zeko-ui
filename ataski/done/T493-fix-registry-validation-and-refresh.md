---
id: T493
title: "Fix registry validation and refresh"
status: done
blockedBy: []
owner: codex
created_at: 2026-07-28T20:10:09Z
updated_at: 2026-07-28T20:13:20Z
---

## Requirements

- Reassess and address the selected universal ERC20 registry review findings
  relative to base commit `89aa990198144a1a184773c94c5e5f9a71897481`.
- Reject the zero Ethereum token address as a canonical asset-record invariant
  before hashing, proposal submission, or registry construction.
- Authenticate an established registry refresh exactly once through
  `EthereumAssetRegistry.refresh`, while retaining full authenticated snapshot
  construction for initial installation.
- Preserve all existing registry, compatibility, governance, cursor,
  concurrency, CI typecheck, and timeout behavior.
- Keep the ignored token-state query amplification finding out of scope.
- Do not run proving, deployment, or repository-wide test and lint suites.

## Test Plan

- TDD.
- RED: add a registry regression that rejects a zero Ethereum token address and
  a client regression that observes one canonical registry-tree authentication
  pass for an established refresh, then run only those focused regressions.
- GREEN: after both production fixes are applied, run one focused
  `eth-bridge-sdk` verification covering the touched registry and client tests.

## RED Evidence

- `moon run eth-bridge-sdk:test -f -- test/registry.test.ts
  test/client.test.ts -t 'rejects zero Ethereum token address|atomically
  replaces the local registry'` failed both intended regressions: the zero
  address was accepted, and an established refresh rebuilt the authenticated
  registry tree twice instead of once.

## GREEN Evidence

- `moon run eth-bridge-sdk:typecheck eth-bridge-sdk:test -f` passed the
  dist-backed package typecheck and all 38 Ethereum bridge SDK tests.
- No proving, deployment, repository-wide test suite, or repository-wide lint
  suite ran.
