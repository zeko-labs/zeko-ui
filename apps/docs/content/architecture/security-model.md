# Security Model

The Ethereum integration is an experimental, permissioned testnet design. Ethereum settlement verifies accepted state transitions, while availability and operation still depend on the deployment's DA committee, sequencer, gateway, and administrative roles.

## Proof verification

Zeko's recursive proofs rely on Pickles and Kimchi. The SP1 settlement program verifies the exported Zeko proof and derives a receipt binding the next state, action checkpoints, and withdrawal commitments. Ethereum contracts verify the SP1 proof and enforce the expected program and verifier identities, chain and contract domain, state continuity, and slot bounds.

Bridge proofs bind ordered deposits to the contract's deposit accumulator and Zeko action checkpoints. Proofs do not independently establish that Ethereum logs are final; the gateway supplies finalized canonical logs, and the contracts bind the resulting values to on-chain state.

## Ethereum finality

The gateway treats Ethereum events as confirmed after their blocks reach the configured RPC's consensus-finalized view. This trusts the RPC's chain view. L2 inclusion and an Ethereum transaction receipt occur before this finality boundary.

A pre-finality reorganization can change observed bridge or settlement progress. A conflicting finalized checkpoint is an operator incident and requires investigation.

## Data availability and liveness

The current design uses three DA nodes with a quorum of two. Those nodes retain batch data required to reconstruct the ledger. A valid state proof does not itself make the underlying data available.

Full Ethereum blob publication, blob-to-batch-root binding, and long-term archival are not implemented. The committee remains a trust and availability assumption. Sequencer, gateway, or prover downtime can delay inclusion, settlement, and withdrawals.

## Administrative control

The deployment is permissioned. Administrative roles can pause operations, alter configuration, and exercise emergency custody powers. Upgrade authority can replace contract logic. These privileges are material trust assumptions; proof verification does not remove them.

Mock-verifier deployments provide no on-chain SP1 proof security. Operators must clearly identify such environments and must not present them as proof-secured deployments.

## Bridge limitations

- Deposits have no cancellation or refund path.
- Withdrawals require an accepted settlement, the configured delay, and a claim transaction.
- Only registered asset mappings are supported for ERC-20 bridging.
- Administrative emergency withdrawal and upgrades can affect custody expectations.
- Public bridge and explorer views depend on their indexed source data and may lag chain progress.

Use test assets appropriate to the deployment. Review its verifier configuration, roles, and current release status before assuming any production security guarantees.
