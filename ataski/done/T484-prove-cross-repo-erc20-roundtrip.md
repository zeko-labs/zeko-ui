---
id: T484
title: "Prove cross-repo ERC20 roundtrip"
status: done
blockedBy: [T481, T482, T483]
owner: codex
created_at: 2026-07-21T19:00:00Z
updated_at: 2026-07-22T00:58:07Z
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

- 2026-07-21/22: `tools/run-local-erc20-bridge-roundtrip.sh` completed the
  fresh cross-repository path with `EXIT:0`. The run deployed and registered a
  mock nine-decimal ERC20 on Anvil, called `submitDeposit`, indexed the exact
  asset-bound action, proved the Zeko outer action witness and deposit
  finalization, deployed the unmodified Mina Foundation fungible-token mirror,
  submitted a debit-first L2 withdrawal, proved its inner witness, exported and
  settled both real OCaml commits, advanced the withdrawal delay, and claimed
  5,000,000,000 token units back from Solidity. It asserted a 95,000,000,000 L2
  vault balance, 5,000,000,000 L2 recipient balance, matching token/asset IDs,
  indexed witness state, Ethereum custody/liability accounting, and the final
  Ethereum recipient delta. The summary recorded `ocamlSettlements: 2`,
  `liveStandardTokenRoundtrip: true`, `anvilCustodyRoundtrip: true`, and
  `sp1ProofsGenerated: 0`. Evidence:
  `logs/erc20-t484-roundtrip-rerun12-20260722.log` in the workspace.
- The decisive live sequencer checkpoints were
  `ERC20 deposit finalization submitted` and
  `ERC20 withdrawal request submitted`; the final standard-token result was
  `status: passed`. The settlement gateway then confirmed the bridge execute
  and both settlement jobs before the delayed token claim.
- Zeko focused ERC20 withdrawal-forest regression passed after matching the
  standard token's vault flags and evaluating the call forest inside a checked
  computation. The sequencer test target also builds cleanly. Evidence:
  `logs/erc20-t484-owner-flags-green1-20260722.log`,
  `logs/erc20-t484-owner-flags-build-20260722.log`, and
  `logs/erc20-t484-fee-recipient-build-20260722.log` in the workspace.
- `pnpm exec moon run bridge-sdk:test bridge-sdk:typecheck bridge-sdk:lint
  eth-bridge-sdk:test eth-bridge-sdk:typecheck eth-bridge-sdk:lint` passed with
  19 bridge SDK test files / 96 tests and 3 Ethereum SDK test files / 14 tests.
  Evidence: `logs/erc20-t484-ui-final-gates-20260722.log` in the workspace.
- The existing Solidity suite remained green after the ERC20 custody and
  delayed-claim additions: 67 tests passed across five Forge suites. Evidence:
  `logs/erc20-forge-cap-final-20260721.log` in the workspace.
- The required native regression
  `src/app/zeko/sequencer/tests/run-sequencer-test.sh real 1 false true`
  completed in 35m33s with `EXIT:0`. It verified the deployed outer VK against
  the real prover before use, accepted all outer witness/commit proofs,
  finalized six native deposits, cancelled three timed-out deposits, committed
  two batches of three withdrawals, and finalized all six withdrawals on L1.
  Evidence: `logs/erc20-t484-native-regression-final4-20260722.log` in the
  workspace.

## Implementation Notes

- Settlement owns the canonical ERC20 registry/custody boundary and emits a
  deterministic `submitDeposit` witness preimage bound to token, asset ID,
  recipient, amount, and nonce. The local runner carries that exact action
  through bridge execute, two settlement receipts, and token claim.
- Zeko archives per-asset bridge readiness and actions, proves the ERC20 outer
  action witness, and composes deposits/withdrawals with the existing bridge
  circuits. Custom-token vault account-update flags now match the unmodified
  standard-token owner template.
- The bridge-export test/live genesis now mirrors production's protocol-owned
  L2 bridge fee recipient. The withdrawal circuit always emits this zero-value
  leaf; omitting the account in that harness caused the previously observed
  account-creation underflow even though production genesis already included
  it. The generic randomized suite retains its historical account set because
  its checked `Initialize_state` fixture is bound to that set.
- The unrelated `Initialize_state` Pickles fixture now compiles lazily, so the
  sequencer executable establishes its recursive circuit dependency order
  before any fixture can perturb it. Real-mode setup also compares the deployed
  outer VK hash with the prover VK and fails immediately on any future ordering
  regression.
- The UI SDK deploys the unmodified Mina Foundation fungible-token contracts,
  funds every distinct absent proved account, grafts only the required
  signature authorization onto the proof-preserved deposit body, and submits
  debit-first token withdrawals through the live sequencer API.
