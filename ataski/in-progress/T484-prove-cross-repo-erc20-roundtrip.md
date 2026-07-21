---
id: T484
title: "Prove cross-repo ERC20 roundtrip"
status: in-progress
blockedBy: [T481, T482, T483]
owner: codex
created_at: 2026-07-21T19:00:00Z
updated_at: 2026-07-21T19:05:00Z
---

## Requirements

- Audit the current `feature/erc20-token-bridge` implementations in `ethereum-settlement`, `zeko`, and `zeko-ui` against the complete ERC20 bridge objective.
- Add or extend an automated local integration harness that exercises a fresh ERC20 through the real repository boundaries: deploy/register and custody it with Solidity `submitDeposit`, derive and submit the exact asset-bound Zeko outer witness action, finalize the deposit through the sequencer proof-only API into the unmodified Mina Foundation fungible-token owner, create a debit-first L2 withdrawal, prove its inner witness, settle the matching receipt, and claim the ERC20 from Solidity.
- Assert Ethereum custody, L2 vault/user balances, token identity/configuration, action/preimage bindings, and final Ethereum recipient balance. Reject mismatched assets or replay where the exercised boundary supports it.
- Use the local Anvil/mock-verifier route only. Do not generate an SP1 proof or submit a paid network proving request.
- Preserve the existing native bridge path and keep all work on the existing feature worktrees/branch.
- If a true automated combined rehearsal cannot be run locally, identify the exact missing executable boundary and implement the smallest production-grade glue needed to make it runnable; do not substitute package-only unit tests for the end-to-end requirement.

## Test Plan

- BDD: first run the existing documented local bridge roundtrip or its ERC20 mode and record RED evidence showing the missing/failed end-to-end behavior.
- Add an executable ERC20 roundtrip scenario with assertions at each chain boundary.
- Run the focused cross-repository scenario, the existing native roundtrip regression, and the relevant Zeko/UI/settlement package gates. Record commands and results as GREEN evidence.

## RED Evidence

- 2026-07-21: `bash tools/run-local-erc20-bridge-roundtrip.sh` from the settlement feature worktree failed with exit 127 because no combined ERC20 runner exists.
- Audit: `tools/run-local-bridge-roundtrip.sh` is hard-coded to native deposit/claim fixture fields, while `contracts/test/NativeBridgePocE2E.t.sol` and `packages/bridge-sdk/test/ethereum-token-deployment.test.ts` cover only their respective contract and local-L2 boundaries. No executable test currently crosses Solidity custody, the Rust deposit transition, the OCaml proof-only API, standard-token composition, and Solidity ERC20 release.

## GREEN Evidence
