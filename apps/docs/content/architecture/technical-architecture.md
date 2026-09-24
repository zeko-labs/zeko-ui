# Technical Architecture

Zeko executes zkApp transactions on L2 and settles proof-bound state transitions on Ethereum. The OCaml implementation owns ledger, transaction, action-state, and recursive proving semantics; the Ethereum integration adds verification, custody, and settlement.

## Components

| Component | Responsibility |
| --- | --- |
| Sequencer | Accepts transactions, applies them to the L2 ledger, dispatches proving work, and prepares commits. |
| Zeko provers | Produce and aggregate Pickles proofs of Zeko state transitions. |
| DA nodes | Retain ordered ledger diffs and provide the current committee's availability attestations. |
| Ethereum gateway | Validates exported proofs, manages proof jobs, submits Ethereum transactions, and indexes finalized chain state. |
| SP1 settlement guest | Verifies the Pickles proof and derives the settlement receipt and withdrawal commitments. |
| SP1 bridge guest | Replays finalized ETH and registered ERC-20 deposits into Zeko actions and checkpoints. |
| Ethereum settlement contract | Verifies SP1 proofs and enforces state continuity, domain binding, and checkpoint rules. |
| Ethereum bridge and asset registry | Hold custody, bind supported token identities, track deposits, and release eligible withdrawal claims. |
| Archive and Actions services | Provide L2 history, indexed actions, witnesses, and registry data to clients. |

## Transaction lifecycle

```text
zkApp / wallet
  -> Zeko sequencer
  -> DA storage and recursive Zeko proofs
  -> Ethereum gateway and SP1 settlement proof
  -> Ethereum settlement contract
  -> accepted state checkpoint
```

The sequencer checks transaction authorization and preconditions, applies account updates, and schedules proofs. A commit proves the cumulative transition. The gateway verifies the exported proof against its pinned verifier configuration and coordinates an Ethereum-compatible SP1 proof. The Ethereum contract checks that the receipt continues the accepted state before recording it.

The gateway retains a Mina-compatible GraphQL interface for the existing sequencer. This is an integration boundary, not a Mina L1 settlement dependency. Archive schemas, `sendZkapp`, Pickles verification, and other inherited identifiers remain part of the implementation.

## Ethereum-to-Zeko deposits

An Ethereum deposit locks ETH or a registered ERC-20 in the bridge contract. The gateway indexes finalized deposit logs. A bridge proof binds an ordered batch to the Ethereum accumulator and derives the corresponding Zeko outer actions. A later Pickles-proven commit synchronizes those actions into the L2-facing state, enabling deposit finalization on Zeko.

## Zeko-to-Ethereum withdrawals

A withdrawal begins as an action on Zeko. The settlement guest verifies the ordered action transition and binds a Keccak claim-tree root to the accepted settlement. After the configured delay, the user submits a Merkle path to the Ethereum bridge, which checks inclusion and claim cursors before releasing the asset.

The expensive proof work occurs during settlement. A withdrawal claimant supplies a Merkle proof rather than generating an SP1 proof.

## Canonical state and recovery

The gateway indexes Ethereum receipts and advances confirmed state at Ethereum's `finalized` boundary. It maintains the corresponding account/action view for the sequencer and recovers from pre-finality reorganizations. L2 archive inclusion, submitted proof jobs, and finalized Ethereum settlement are separate states.

## Data availability

The current Sepolia design retains the 2-of-3 Zeko DA committee. Ethereum receives accepted proof-bound checkpoints, not the complete batch payload. EIP-4844 blob publication, retention, and proof binding between blobs and Zeko batch roots remain production work. See [Security Model](./security-model.md).
