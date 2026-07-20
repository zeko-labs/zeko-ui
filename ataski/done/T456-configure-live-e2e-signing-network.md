---
id: T456
title: "Configure live E2E signing network"
status: done
blockedBy: []
owner: codex
created_at: 2026-07-20T16:49:08Z
updated_at: 2026-07-20T17:19:00Z
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

- `moon run eth-bridge-sdk:lint` passed; forced uncached `eth-bridge-sdk:typecheck` passed; forced uncached `eth-bridge-sdk:test` passed 9/9 tests. Pre-commit lint/format and `bridge-ui:typecheck` also passed.
- `tools/run-live-sequencer-bridge-e2e.sh` passed with both networks set to `testnet` (exit 0; `/root/zeko/logs/zeko-wire-live-final-6-20260720.log`). The browser SDK finalized the deposit, submitted the native withdrawal, and the OCaml harness emitted two settlement exports; zero SP1 proofs were requested or generated.
