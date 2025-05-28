# Security Model

_Zeko's security relies on a combination of the underlying Mina Protocol's security guarantees and the specific design choices within the Zeko Layer 2 architecture. The security model is built upon the interactions and properties of several key components._

## Proof System

The security of the state transitions within Zeko is fundamentally tied to the **soundness of the underlying zero-knowledge proof system**, specifically Mina's implementation of **ZK-SNARKs (Kimchi and Pickles)**.

- Transaction batches processed off-chain are compressed into a **single, succinct proof** using recursion. This proof attests to the validity of all transactions and the resulting state transition from a previous ledger hash to a new one.
- The L1 smart contract verifies this **root proof**. If the proof is **invalid**, the L1 consensus mechanism will **reject the transaction**, preventing an incorrect state transition from being committed on Layer 1.
- Permissions on zkApps, such as requiring **proof authorization** for state changes or fund transfers, ensure that only valid computations (proven off-chain) can trigger sensitive actions. This principle is inherited by Zeko's zkApps and custom tokens.

_The proof system acts as a **cryptographic guarantee** that the L2 state transitions are correct, provided the L1 correctly verifies the submitted proofs._

::: warning ⚠️ Proof System Limitations ⚠️
State transition proofs are only as secure as the underlying proof system.
:::

## Layer 1 Consensus

Zeko's security model is anchored to the **Layer 1 Mina blockchain** through the commitment of the L2 state (specifically, the rollup ledger hash) to a zkApp account on L1.

- The **finality** of the committed L2 state is dependent on the **Mina L1 consensus**. A batch proof is only accepted and the L1 state updated if it is agreed upon by the L1 consensus participants.
- In the event of a **rollback on Mina L1**, the Zeko L2 state must also be rolled back to a corresponding earlier state. This is necessary to maintain **consistency** and the **security of bridges** between L1 and L2.
- The L1 consensus effectively **validates the work** performed by the sequencer and provers by checking the root batch proof, ensuring that invalid state transitions are not accepted onto the L1 chain.

_The security of Zeko's publicly committed state inherits the strong, decentralized security properties of Mina's Layer 1 consensus._

::: warning ⚠️ L1 Consensus Limitations ⚠️
Committed state is committed only if the L1 consensus says so, and invalid state transition gets rejected only if consensus says so.
:::

## Data Availability Layer

The **Data Availability (DA) layer** is a crucial component for the **liveness and verifiability** of the Zeko rollup.

- All transaction data for the processed batches is **published to the DA layer**.
- This availability allows **anyone** to download the transaction data and independently **reconstruct the rollup's state**. This ability to verify the state is key to detecting malicious sequencer behavior, such as creating fraudulent state transitions.
- The DA layer is also essential for facilitating **safe exits** (withdrawing funds from L2 to L1) in situations where the sequencer might be offline or non-cooperative. Users can prove their claim based on data available in the DA layer.

_By ensuring that the necessary data for state reconstruction is public and accessible, the DA layer provides a critical **check-and-balance mechanism** against sequencer misbehavior and ensures the rollup's recoverability and liveness._

::: warning ⚠️ DA Limitations ⚠️
If the DA layer fails or data is not published, it becomes **impossible to verify or reconstruct the state**, effectively halting the rollup and compromising its liveness.
:::

## Sequencer

The sequencer plays a vital role in collecting, ordering, and processing transactions, and coordinating the creation and submission of batch proofs.

- The sequencer applies transactions to the ledger and generates proofs. It is responsible for ensuring **preconditions, permissions, and authorizations** are met for each transaction.
- It aggregates transactions into batches and generates the recursive proofs that are eventually committed to L1.
- An **emergency pause mechanism**, controlled by a designated public key (potentially governed by a committee), provides a security failsafe to halt the rollup in critical situations.

_The sequencer actions are ultimately subject to verification by the proof system, the DA layer, and the L1 consensus._

::: warning ⚠️ Sequencer Limitations ⚠️
In the current single-sequencer design, a single sequencer could potentially **censor** specific user transactions by simply omitting them from batches. Future plans include implementing **shared sequencing** via an auction mechanism to decentralize this role and improve **censorship resistance and liveness**.
:::
