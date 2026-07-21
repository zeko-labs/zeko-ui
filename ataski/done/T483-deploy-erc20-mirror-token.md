---
id: T483
title: "Deploy ERC20 mirror token"
status: done
blockedBy: [T482]
owner: codex
created_at: 2026-07-21T17:43:37Z
updated_at: 2026-07-21T18:37:02Z
---

## Requirements

- Add an operator-facing deployment module for one configured ERC20 mirror using the unmodified `mina-fungible-token` `FungibleToken` and `FungibleTokenAdmin` contracts.
- Atomically deploy and initialize the standard owner/admin where possible, create the separate proof-controlled bridge-vault token account, set its Zeko bridge verification key and proof permissions, and mint exactly the configured bounded inventory into it.
- Validate before submission that the derived Mina token ID, owner, vault, ERC20 address, decimals, asset ID, Solidity registration, Solidity deposit cap, and requested L2 inventory all match.
- Return a deployment manifest containing public identifiers and transaction hashes only. Never load, store, or print private keys beyond caller-supplied in-memory signers.
- Provide an executable local-chain roundtrip proving the standard owner accepts vault-to-user deposits and debit-first user-to-vault withdrawals while rejecting inventory-cap or registry mismatches.

## Test Plan

- BDD. Add a local Mina blockchain scenario that deploys the standard contracts and bridge vault, mints the bounded inventory, then exercises balanced deposit and withdrawal forests through `approveBase`.
- RED must demonstrate that no deployment path currently installs the bridge VK or enforces equality between L2 inventory and the Solidity cap.
- GREEN must assert deployed owner/admin/vault state, token ID and VK identity, exact inventory, balanced transfers, and rejection of mismatched cap/asset configuration.

## RED Evidence

- The T482 SDK gate exposes proof composition only; no deployment module exists
  to install the Zeko vault verification key or bind minted L2 inventory to the
  registered Solidity cap. The local standard-token roundtrip test described
  below therefore cannot be authored against a public deployment API yet.
- `pnpm --dir packages/bridge-sdk exec vitest run
  test/ethereum-token-deployment.test.ts` failed as intended because
  `src/ethereum-token-deployment` did not exist.

## GREEN Evidence

- `pnpm --dir packages/bridge-sdk exec vitest run
  test/ethereum-token-deployment.test.ts` passed 3/3 tests. The local-ledger
  scenario deployed the unmodified owner/admin, installed the asset-specific
  bridge VK and proof send permission, minted the exact cap, and completed the
  vault-to-user and debit-first user-to-vault transfers through `approveBase`.
- `moon run bridge-sdk:test` passed 92/92 tests across 19 files, including cap,
  registry, asset, decimal, token-ID, owner, and VK mismatch rejection.
- `moon run eth-bridge-sdk:test` passed 14/14 tests, including exact reads of the
  immutable Solidity token registration used by deployment validation.
- Bridge, Ethereum bridge, and GraphQL build, typecheck, and lint gates passed;
  `pnpm install --offline --frozen-lockfile` also accepted the final lockfile.
