---
id: T482
title: "Prove and compose ERC20 L2 bridge"
status: done
blockedBy: []
owner: codex
created_at: 2026-07-21T17:43:37Z
updated_at: 2026-07-21T18:09:16Z
---

## Requirements

- Extend `packages/bridge-sdk` with the Zeko GraphQL operations and public types needed to read the configured immutable ERC20 asset, request an asset-specific deposit-finalization proof, request an ERC20 withdrawal witness proof, and poll the returned `provingResult` forest.
- Compose the proved deposit vault forest beneath the unmodified `mina-fungible-token` `FungibleToken.approveBase` method before submission. The helper-account signature must be created only after the owner wrapper fixes the final transaction commitment.
- For withdrawals, create the exact debit-first standard-token forest, derive the standard owner's proof authorization kind and call data from the draft forest, request the Zeko inner-witness proof, and attach the standard-owner proof and user signature without changing any account-update body digest.
- Reject mismatched configured asset IDs, token owners, token IDs, vaults, verification-key hashes, malformed proving results, and any owner/vault forest whose body differs from the draft approved by the standard token contract.
- Preserve the existing native bridge interface and finality behavior. Do not execute the proof-only GraphQL mutations until the standard-token proof and required signatures have been composed.
- Add a publishable-package changeset and keep the implementation compatible with the monorepo and split-package build.

## Test Plan

- BDD. First add SDK tests that describe the public deposit and withdrawal composition flows using executable account-update forests and a deterministic GraphQL adapter.
- RED must prove the current SDK lacks configured-asset discovery, sends no asset-specific mutations, and cannot produce a forest accepted by the standard token owner's `approveBase` shape.
- GREEN must cover successful deposit and withdrawal composition plus wrong asset, wrong owner/VK, changed body digest, pending proof, malformed proof result, and GraphQL error cases.

## RED Evidence

- `pnpm --dir packages/bridge-sdk exec vitest run test/prover.test.ts`
  failed 3/6 tests as intended: `pollProvedForest is not a function`. The
  existing polling interface only waits for an executed native transaction and
  cannot return the proof-only forest required for FungibleToken composition.

## GREEN Evidence

- `moon run bridge-sdk:test` passed 89/89 tests across 18 files.
- `moon run bridge-sdk:build` and `moon run bridge-sdk:typecheck` passed.
- `moon run eth-bridge-sdk:test` passed 13/13 tests and
  `moon run eth-bridge-sdk:typecheck` passed.
- Focused ERC20/prover coverage passed 19/19 tests, including the shared OCaml
  asset-aware aux vector, immutable config checks, proof-only polling, malformed
  forests, wrong owner/VK, and changed owner-subtree digests.
