---
id: T481
title: "Add ERC20 Ethereum bridge SDK"
status: done
blockedBy: []
owner: codex
created_at: 2026-07-21T15:20:10Z
updated_at: 2026-07-21T15:37:56Z
---

## Requirements

- Extend `@zeko-labs/eth-bridge-sdk` with a canonical ERC-20 deposit method that calls `submitDeposit(address,uint256,uint256)` and returns the indexed bridge nonce and gateway status.
- Expose the proof-bound ERC-20 asset identifier on indexed deposit status responses.
- Parse the gateway's `/v1/bridge/token-withdrawals/:sequence/:offset` response and expose lookup and claim methods that call `claimERC20Withdrawal` with the exact token, asset ID, amount, action-fields hash, and depth-16 proof.
- Preserve all existing native deposit and withdrawal APIs and validation behavior.
- Do not add a dependency. This task does not fabricate the L2 Mina Fungible Token withdrawal transaction; that requires the token-owner approval/prover endpoint and remains in the Zeko circuit/runtime scope.
- Add the required package changeset.

## Test Plan

- TDD: first add SDK tests proving `depositToken` calls canonical `submitDeposit`, extracts `BridgeDeposit`, and reports the gateway status, plus gateway/claim tests proving token and asset identity are parsed and forwarded exactly.
- Run `moon run eth-bridge-sdk:test`, `moon run eth-bridge-sdk:typecheck`, and `moon run eth-bridge-sdk:lint` from the repository root.

## RED Evidence

- `moon run eth-bridge-sdk:test -f` (2026-07-21): failed as intended because `GatewayClient.tokenWithdrawal`, `EthereumBridgeClient.depositToken`, `EthereumBridgeClient.claimTokenWithdrawal`, and deposit `assetId` parsing did not exist (4 behavior failures; 9 existing tests passed).

## GREEN Evidence

- `moon run eth-bridge-sdk:test -f`: 13 tests passed across 3 files, including canonical `submitDeposit`, asset-aware gateway parsing, and exact `claimERC20Withdrawal` calldata.
- `moon run eth-bridge-sdk:typecheck -f`: passed.
- `moon run eth-bridge-sdk:lint -f`: passed (12 files checked).
- `git diff --check`: passed.
