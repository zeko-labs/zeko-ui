# @zeko-labs/eth-bridge-sdk

## 0.2.0

### Minor Changes

- bc1b6ac: Add canonical ERC-20 deposits, Solidity registration reads, asset-aware gateway records, L2 token finalization and withdrawal requests, and proof-bound ERC-20 withdrawal claims.
- 89aa990: Add reusable Ethereum bridge preparation hooks, separate withdrawal senders from destinations,
  and introduce a browser-facing Ethereum bridge SDK for deposits, status recovery, withdrawal
  requests, and native claims.
- bc1b6ac: Add the universal append-only ERC-20 asset registry model, governed registration signing, cryptographically verified membership preflight, V2 settlement-batch proofs, circuit-aligned proposal validation and tail cancellation, registry-bound action encoding, authenticated runtime checkpoint, deterministic asset lookup, and path refresh support.

### Patch Changes

- 89aa990: Bind Ethereum deposit finalization witnesses to the bridge contract address reported by the gateway, and construct browser bridge account updates consistently with the sequencer.
- Updated dependencies [89aa990]
- Updated dependencies [bc1b6ac]
- Updated dependencies [43b16a0]
- Updated dependencies [89aa990]
- Updated dependencies [89aa990]
- Updated dependencies [bc1b6ac]
  - @zeko-labs/bridge-sdk@0.4.0
