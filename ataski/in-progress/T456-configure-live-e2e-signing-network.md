---
id: T456
title: "Configure live E2E signing network"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-07-20T16:49:08Z
updated_at: 2026-07-20T17:06:00Z
---

## Requirements

- Make the Ethereum bridge SDK live-sequencer example sign Mina transactions with the L1 and L2 network IDs supplied by its caller.
- Accept only the o1js built-in signing domains `mainnet` and `testnet` for this local harness, and fail clearly for missing or invalid input.
- Add the required changeset for the public `@zeko-labs/eth-bridge-sdk` package.
- Do not embed machine-specific paths or fixture-specific keys.

## Test Plan

- BDD: use the existing native live-sequencer bridge E2E as the acceptance test because it exercises the browser SDK against the real OCaml testing ledger and signer.
- RED: the retained testnet identity must fail when the example hardcodes `mainnet`, proving the domain mismatch is observable at the GraphQL submission boundary.
- GREEN: pass both testnet networks explicitly and require the full live E2E to produce both OCaml settlement exports and complete deposit finalization plus withdrawal submission.

## RED Evidence

- `tools/run-live-sequencer-bridge-e2e.sh` with the retained testnet fixture identity failed in `eth-bridge-sdk:live-sequencer-e2e` after deposit preparation with `[GraphQL] verify_signature: signature does not verify` (exit 1; `/root/zeko/logs/zeko-wire-live-final-4-20260720.log`). The OCaml ledger ran with `--network-id testnet`; the example configured `l1Network: "mainnet"`.
- After making L1 configurable and passing `testnet`, the same boundary still rejected the signature (`/root/zeko/logs/zeko-wire-live-final-5-20260720.log`). `finalizeDeposit` is created after `setL2`, and the example was still hardcoded to the custom `zeko-testnet` domain while the live sequencer and its signer use built-in `testnet`; both client domains must match their target services.

## GREEN Evidence
