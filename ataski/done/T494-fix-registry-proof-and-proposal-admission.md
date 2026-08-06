---
id: T494
title: "Fix registry proof and proposal admission"
status: done
blockedBy: []
owner: codex
created_at: 2026-08-03T10:56:57Z
updated_at: 2026-08-03T11:14:38Z
---

## Requirements

- Make TypeScript asset-record batch membership use the V2 leaf domain and bind both the canonical Ethereum record hash and Mina record commitment exactly as Rust and Solidity do.
- Add a deterministic cross-language golden vector that detects leaf/root drift in TypeScript, Rust, and Solidity without introducing another hashing implementation.
- Reject Ethereum asset proposals in the SDK before wallet submission when the Mina token ID is not derived from the proposed owner or when the MFT standard ID, shared vault key, or universal bridge ID differ from authenticated runtime configuration.
- Add the narrowest safe Solidity recovery for an operator-submitted malformed proposal: an admin may cancel only the un-settled, most-recent pending proposal, restoring uniqueness mappings and `proposedAssetCount`; active, non-tail, and settled proposals remain immutable.
- Extend the SDK/contract ABIs and focused tests for the recovery path while preserving valid proposal and activation behavior.
- Replace tracked absolute checkout-specific log references with
  workspace-relative `logs/...` references.
- Do not perform the proposed Rust receipt-helper or OCaml commit-rule module refactors.
- Keep evidence honest: distinguish the depth-8/256-entry circuit capacity and fake-vector coverage from the two-asset live PoC; do not claim real maximum-size Pickles proving evidence unless it is actually produced.
- Strengthen the cross-asset negative acceptance case at the closest existing executable transaction seam without adding a new E2E framework; if the existing live harness cannot submit the deliberately mixed transaction without unsafe/private-key exposure or invasive production escape hatches, remove the full-cross-stack claim and record the exact remaining gap.

## Test Plan

- BDD for the public SDK and Solidity admission/recovery behavior, supported by focused deterministic unit vectors.
- RED: add tests showing the current TypeScript batch root disagrees with the V2 expected leaf/root, malformed proposals reach wallet submission, and a malformed tail proposal cannot be removed.
- GREEN: run the focused eth-bridge SDK tests, Rust settlement receipt tests, Forge registry tests, relevant Moon package gates, and repository formatting/diff checks.
- Preserve positive controls for a valid proposal, valid V2 batch activation proof, and normal pending-to-active behavior.

## RED Evidence

- `moon run eth-bridge-sdk:test -f` failed exactly at the new boundaries: the SDK produced the old V1 batch root (`0x4fb2...08b1`) instead of the independently reconstructed V2 root (`0xf162...3ac`), and `proposeAsset` submitted a transaction for a record with a non-derived Mina token ID. The remaining 38 tests passed.
- `forge test --match-test test_UniversalRegistryCanCancelOnlyUnsettledTailProposal -vv` failed to compile because `IZekoAssetRegistry.cancelLastPendingAsset` does not exist, demonstrating there is no recovery path for an un-settled malformed tail proposal.

## GREEN Evidence

- TypeScript now uses `ZEKO_ASSET_RECORD_BATCH_LEAF_V2` and hashes
  `domain || recordHash || recordCommitment`. TypeScript, Rust, and Solidity all
  pass the same fixed leaf/root vector (`0xd3c4...d1fc` /
  `0x3585...0a3b`).
- SDK proposal admission derives the Mina token ID from the packed owner and
  compares schema, MFT standard VK, shared vault, and universal bridge VK with
  the authenticated Zeko runtime before any wallet call. The focused positive
  control still submits a valid proposal.
- Solidity cancellation is bridge-admin-only and unwinds only the latest
  pending record. Focused tests cover unauthorized and non-tail rejection,
  reverse-order cancellation, uniqueness-map/count restoration, reproposal,
  and settled-record immutability. The SDK ABI and client expose that narrow
  recovery operation.
- `moon run eth-bridge-sdk:build eth-bridge-sdk:typecheck
  eth-bridge-sdk:test eth-bridge-sdk:lint eth-bridge-sdk:format -f` passed; the
  SDK test suite has 41 passing tests. Full `pnpm exec moon ci` passed all 34
  selected actions (25 cached, 6 setup actions skipped), including 114 bridge
  SDK tests. Log: `logs/t494-ui-moon-ci.log`.
- `cargo test --locked -p settlement-program` passed all 12 tests. Log:
  `logs/t494-settlement-program.log`.
- `forge test -vvv` passed all 79 Solidity tests. Log:
  `logs/t494-forge.log`.
- Rust, Solidity, and TypeScript formatting checks plus `git diff --check`
  passed. No SP1 proof generation or paid proving was run.
- The live harness cannot construct and submit a deliberately mixed
  A-identity/B-owner transaction through the public SDK. Its former
  `crossAssetRejected` flag stopped at an off-chain registry lookup failure, so
  the flag and the full-cross-stack claim were removed. A submitted mixed
  transaction with unchanged L2 balances and L1 custody remains outside this
  narrow fix and needs an explicit integration seam rather than a production
  escape hatch.
