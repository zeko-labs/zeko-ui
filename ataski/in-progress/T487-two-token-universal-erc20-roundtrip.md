---
id: T487
title: "Two-token universal ERC20 roundtrip"
status: in-progress
blockedBy: [T486]
owner: codex
created_at: 2026-07-24T13:44:30Z
updated_at: 2026-07-24T13:44:30Z
---

## Requirements

- Replace the retained single-token live harness with two independently
  registered ERC-20 mirrors using distinct MFT owners and derived token IDs,
  one shared vault public key, and one universal bridge circuit/VK.
- Exercise Ethereum proposal, proof-backed Zeko append registration, settlement
  checkpoint synchronization, and Ethereum activation before either token can
  accept deposits.
- Deposit and finalize both assets, preserve independent replay helpers and
  balances, submit withdrawals for both, and claim the matching Ethereum token
  after the delay.
- Assert the two vault accounts share the same public key and bridge VK while
  their token IDs and balances remain distinct; add a cross-asset rejection
  before balance movement.
- Version the deployment/scenario manifests with registry account, root/count/
  schema, canonical records, approved MFT standard ID, universal bridge ID/VK,
  and all three source revisions.
- Keep native bridge behavior and explicit legacy fixture compatibility intact.
  Use the Anvil mock SP1 verifier and do not generate a local or paid SP1 proof.
- Update active status/configuration documentation and remove stale statements
  that the active sequencer supports only one immutable ERC-20.

## Test Plan

- RED: the retained ERC-20 live harness still reads
  `Inputs.Ethereum_token` and the removed `--ethereum-token-*` CLI flags, so a
  universal `ethereum_assets` configuration cannot start the integration path.
- GREEN: run focused OCaml vectors, Rust settlement tests, full Forge tests, all
  affected UI package gates, then the real two-token local roundtrip in the
  prescribed tmux sessions with no SP1 proof generation.

## RED Evidence

- Static harness/config check found `sequencer_test.ml` requiring
  `Inputs.Ethereum_token.enabled` and
  `tools/run-local-erc20-bridge-roundtrip.sh` invoking the removed singular
  `--ethereum-token-*` CLI flags.

## GREEN Evidence
