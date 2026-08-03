---
id: T487
title: "Two-token universal ERC20 roundtrip"
status: done
blockedBy: [T486]
owner: codex
created_at: 2026-07-24T13:44:30Z
updated_at: 2026-07-24T23:29:11Z
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

- BDD RED: the retained ERC-20 live harness still reads
  `Inputs.Ethereum_token` and the removed `--ethereum-token-*` CLI flags, so a
  universal `ethereum_assets` configuration cannot start the integration path.
- BDD GREEN: run focused OCaml vectors, Rust settlement tests, full Forge tests,
  all affected UI package gates, then the real two-token local roundtrip in the
  prescribed tmux sessions with no SP1 proof generation.

## RED Evidence

- Static harness/config check found `sequencer_test.ml` requiring
  `Inputs.Ethereum_token.enabled` and
  `tools/run-local-erc20-bridge-roundtrip.sh` invoking the removed singular
  `--ethereum-token-*` CLI flags.

## GREEN Evidence

- Zeko OCaml builds and vectors passed from the pinned Nix shell, including
  `asset_registry_vectors.exe` append/membership/registration coverage and its
  fake/vector capacity run: 256 assets in 6,734 ms with 3,082,752 top heap
  words. This is circuit-capacity coverage, not real maximum-size Pickles
  proving time or memory evidence.
  The settlement calldata and registry-body compatibility vectors also matched
  the exact Rust fixtures.
- The final locked Rust matrix passed: Pickles verifier 27/27, settlement
  program 10/10, bridge program 4/4, withdrawal program 8/8, proof API 27/27
  with only the two intentional slow SP1 execution tests ignored, and shared
  SP1 library 6/6. The settlement set includes the permanent OCaml registration
  call-forest regression vector.
- `forge test -vvv` passed all 74 Solidity tests, including two-record
  activation, duplicate/cross-asset rejection, per-token liabilities, exact
  withdrawal leaves, and the deterministic deployment module split.
- `pnpm exec moon ci` passed all 34 selected UI actions (20 cached, 6 setup
  actions skipped), including the Actions API/indexer, bridge SDK, and Ethereum
  bridge SDK tests, typechecks, builds, lint, and formatting.
- The proof-backed live Zeko phase passed in
  `logs/universal-erc20-full-roundtrip-20260725-retry19.log`: two
  distinct MFT owners/token IDs used one shared vault and universal bridge VK;
  both registration proofs, both deposit finalizations, both withdrawals, live
  sequencer GraphQL, and the Actions preparation API passed; independent final
  balances were 95,000,000,000/5,000,000,000 and
  195,000,000,000/5,000,000,000. The run asserted distinct cross-asset
  identities but did not submit a deliberately mixed transaction.
- The exact Anvil custody replay passed in
  `logs/universal-erc20-custody-20260725-retry22.log`: both pending
  assets activated from the registry settlement, both deposits were witness
  indexed and synchronized, both delayed claims returned the matching ERC-20,
  and all registration/deposit-sync/withdrawal settlements confirmed.
- The E2E used the Anvil mock verifier throughout and reported
  `sp1ProofsGenerated: 0`; no local or paid SP1 proof was requested.
- `tools/test-workspace-paths.sh`, Rust formatting checks, shell syntax checks,
  and `git diff --check` passed. All three feature worktrees were clean before
  this completion-only board update.

## Evidence correction (2026-08-03)

- The former `crossAssetRejected` live-harness flag exercised only an off-chain
  registry lookup failure; it did not submit an A-identity/B-owner transaction.
  That misleading check was removed in T494. The full submitted cross-stack
  negative case, including unchanged L2 balances and L1 custody, remains a
  separate acceptance gap because the public client exposes no mixed-identity
  transaction path.
