# Layer 2 Scaling Solutions

A Layer 2 processes transactions outside a base chain and commits results back to it. Zeko's settlement chain is Ethereum; its execution layer uses zkApps and a Mina-derived ledger.

## Batches and validity proofs

A sequencer orders transactions and applies them to the L2 state. Proof workers establish the validity of the resulting state transitions and aggregate them into a batch proof. Ethereum contracts verify the proof-backed settlement and advance the accepted state.

Zeko uses Pickles recursion for its execution proofs and SP1 to verify those proofs for Ethereum settlement. See [Technical Architecture](../architecture/technical-architecture.md).

## Inclusion and finality

An L2 transaction can be included before its batch reaches Ethereum. Ethereum acceptance, Ethereum finality, and bridge withdrawal eligibility are later milestones. Applications should show these stages separately rather than promising instant finality.

## Data availability

A validity proof establishes correct execution; it does not supply all the data needed to reconstruct the ledger. The current Zeko testnet uses a 2-of-3 DA committee. Full Ethereum blob publication and binding to the Zeko batch root remain future production work.

## Privacy

Zero-knowledge programs can hide private inputs. Public transactions and bridge activity are not automatically private merely because the system uses validity proofs.
