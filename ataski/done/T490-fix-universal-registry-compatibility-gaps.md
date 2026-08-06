---
id: T490
title: "Fix universal registry compatibility gaps"
status: done
blockedBy: [T489]
owner: codex
created_at: 2026-07-28T17:58:37Z
updated_at: 2026-07-28T18:27:08Z
---

## Requirements

- Route ERC20 deposit finalization from immutable action encoding metadata when
  legacy and universal runtime configurations coexist; do not infer V2 from the
  presence of an asset selector.
- Fetch the universal registry runtime extension without making the legacy
  `FetchConfig` query invalid on pre-registry sequencers.
- Keep authenticated universal lookup available for every registered token
  when a legacy single-token runtime is also configured.
- Require every registry append refresh to match a freshly authenticated
  runtime root, count, schema, and shared registry identities.
- Allow the first authenticated append to establish shared identities for an
  initially empty registry while preserving those identities thereafter.
- Compare registry records by their canonical field tuple or commitment, not
  JavaScript property insertion order.
- Preserve and expose pending and canonical registry finality through archive
  ingestion, storage, and the Actions API without hiding pending records from
  finalization-oriented lookups.
- Compute deposit activity state with each ERC20 asset's derived helper-token
  cursor rather than the native helper-token cursor.
- Track registry and inner indexing cursors independently in runtime status,
  health, reset, and CLI contracts.
- Remove the Actions indexer's direct `viem` dependency and normalize Ethereum
  addresses with a first-principles local implementation.
- Keep the registry full-rescan optimization deferred, retain existing
  changeset coverage for publishable packages, and do not run paid proving or
  deployment.

## Test Plan

- TDD.
- Add focused regression tests for dual-runtime V1/V2 selection, legacy config
  fallback, two-token runtime lookup, runtime-anchored refresh, authenticated
  first append, canonical record equality, pending/canonical registry
  persistence, asset-specific deposit state, independent registry progress,
  and local Ethereum address normalization.
- Per the fix-round constraint, do not execute tests between individual fixes;
  run one consolidated focused Moon/Vitest verification after all
  implementation changes are complete.

## RED Evidence

- At `7adfdc2`, `resolveEthereumTokenAsset` chooses V2 whenever a selector and
  universal runtime coexist, while the high-level finalization methods always
  provide a selector and never carry the indexed deposit encoding version.
- The legacy `FetchConfig` operation requests `ethereumAssets` directly, so a
  pre-extension GraphQL schema rejects the entire operation before returning
  the valid legacy configuration.
- Runtime-only Ethereum deposit resolution falls back to `ethereumToken` and
  rejects any second universal token despite authenticated registry lookup
  being available.
- `EthereumAssetRegistry.refresh` authenticates only against its previous
  in-memory config, rejects a configured first append after an unconfigured
  empty snapshot, and compares records through `JSON.stringify` object order.
- Archive registry queries request only `CANONICAL`; registry checkpoint and
  record tables contain no finality field, so pending visibility cannot survive
  ingestion or reach the Actions API.
- `listDepositsWithStates` merges all Ethereum deposits against the native
  helper-token cursor, and the indexer folds registry progress into the inner
  cursor with `Math.max`.
- `services/actions/indexer/src/asset-registry.ts` imports `getAddress` and
  address types from the newly added direct `viem` dependency.
- Focused regression tests for these contracts are absent. Their RED execution
  is intentionally deferred to the single final verification required by this
  review-fix round.

## GREEN Evidence

- `git diff --check` passed.
- `moon run graphql:typecheck bridge-sdk:typecheck bridge-sdk:test
  eth-bridge-sdk:typecheck eth-bridge-sdk:test actions-api:typecheck
  actions-indexer:typecheck -f` passed after rebuilding the ignored
  `eth-bridge-sdk/dist` declarations used by its live example.
- Bridge SDK passed 113 tests, Ethereum Bridge SDK passed 35 tests, and all
  affected package typechecks and dependency builds passed.
- Focused Actions Indexer suites passed 18 tests across asset registry,
  independent cursor state, health monitoring, and CLI validation. The
  indexer-state suite used inert required environment values and made no
  network or database connection.
- No proving, deployment, full repository test suite, or full repository lint
  suite was run.
