# Concepts for Operators

## Execution and settlement

The sequencer orders Zeko transactions and applies them to the L2 ledger. Zeko proof workers produce recursive Pickles proofs. The Ethereum gateway verifies exported proofs and coordinates SP1 proof jobs; Ethereum contracts verify the resulting proof and accept a state checkpoint.

The gateway's Mina-compatible API lets the sequencer retain its existing transaction and action interface. This compatibility does not imply a live Mina L1 dependency.

## Data availability

The current Ethereum testnet retains three DA nodes with quorum two. Availability of batch data is separate from proof validity. Operators must preserve ordered diffs and restore enough state to serve and reconstruct the ledger.

Ethereum blob DA is the intended production direction. Full payload publication, root binding, and archival are not complete in the current integration.

## Bridge progress

Ethereum deposits must reach the gateway's finalized chain view before bridge processing. The derived outer actions become usable on L2 after a later settlement synchronizes them. Withdrawals start with inner actions on L2, then require a settlement-bound claim root, the configured delay, and an Ethereum claim.

Do not treat a submitted proof, L2 archive row, or pending Ethereum receipt as a completed bridge operation. Equally, do not change the sequencer or Actions API's inclusion gates just to simplify a status label.

## Fees and identities

The Ethereum-backed deployment uses ETH as its native asset. Zeko amounts use nine decimal places, while Ethereum ETH uses eighteen. Native fee values and account-creation costs come from the deployment configuration.

Release identity includes the bridge address embedded in circuits, proof verification keys, genesis and action checkpoints, DA keys, registry identities, and signing domain. These must be upgraded coherently; user-facing naming changes do not authorize changing cryptographic identifiers.

## Reliability and trust

Track inclusion, proof jobs, Ethereum finality, archive freshness, and claims as separate operational signals. Gateway and sequencer downtime affect liveness. Contract administration and upgrades remain powerful trust assumptions in the experimental deployment.

See [Getting Started](./getting-started.md) for the deployment runbooks and [Security Model](../architecture/security-model.md) for limitations.
