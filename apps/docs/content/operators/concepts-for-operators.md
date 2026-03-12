# Concepts for Operators

:::warning
WIP: This section is under construction.
:::

This section provides an overview of the key concepts network operators should understand when running infrastructure for Zeko.

## Network Topology

Zeko operates as a Layer 2 (L2) ecosystem built on top of Mina Protocol (Layer 1). The network topology involves several interconnected components and roles:

- **Sequencer**: This is a server that acts as the transaction collector and processor for the Zeko L2. The sequencer accepts transactions from users, typically via a GraphQL API. It applies these transactions to the Zeko ledger. The sequencer then posts the transaction data on the Data Availability (DA) layer and sends them to provers. It is responsible for proving the validity of transactions using zero-knowledge proofs and efficiently grouping transactions into batches. Sequencers generate a queue of pending transfer requests. They select and prove bridge transfer requests, aggregating the proofs. Once a batch is finalized, the sequencer posts the batch and receipts to the DA layer and then commits the final batch proof to the L1 zkApp (rollup contract). Currently, it's not possible to run multiple sequencers.
- **Prover**: This component receives transactions from the sequencer and generates proofs for their validity. In the transaction snark binary tree, provers prove individual transactions or account updates, which are then merged.
- **Data Availability (DA) Layer Nodes**: This layer is responsible for storing all the transaction data that occurs on the rollup. DA layer nodes are described as a bunch of nodes, each replicating the same storage. The sequencer sends the transaction data to the DA layer.
- **L1 ZkApp (Verifier Contract)**: This is a smart contract deployed on the Mina Protocol L1. It acts as a bridge between L1 and L2. The L1 zkApp's state stores the current ledger hash of the Zeko rollup. The sequencer sends aggregated proofs of transaction batches to this L1 contract. The L1 contract verifies these proofs and updates its state to the new ledger hash. Communication from L2 to L1 also happens via posting actions to an inner account on L2, which synchronizes with the outer L1 zkApp account on commit.
- **L1 Mina Nodes**: These are the standard nodes of the Mina Protocol Layer 1 network. The sequencer ultimately sends aggregated batch proofs to the L1, which update the state of the L1 zkApp.
- **Archive Nodes**: These nodes index the history of the blockchain. Mina archive nodes can be used to index the history of the Zeko rollup by running a Zeko archive relay adapter that subscribes to the sequencer and relays new blocks to the archive.

The overall flow involves transactions being sent to the sequencer, processed off-chain, data being stored on the DA layer, proofs being generated and aggregated, and finally, a single aggregated proof being committed to the L1 Mina zkApp to update the rollup's state.

## Role of the ZkApp (Verifier Contract) on Mina L1

The Zeko rollup is implemented as a **zkApp account** on the Mina Layer 1 blockchain. This L1 zkApp serves as the **verifier contract**. Its primary role is to act as the authoritative state anchor for the Zeko L2.

- The L1 zkApp's state holds the current, verified hash of the Zeko L2 ledger.
- The Zeko sequencer processes batches of transactions and generates a single, aggregated proof that represents the transition from the previous L2 ledger state (hash A) to the new L2 ledger state (hash D).
- This aggregated proof (e.g., A->D) is then sent to the L1 and verified by the Zeko zkApp contract.
- If the proof is valid, the L1 zkApp's state is updated to the new ledger hash (D).
- This process effectively compresses the validation of a batch of transactions on L2 into the verification of a single constant-sized proof on L1.

The L1 zkApp also plays a role in the bridging process, receiving actions posted on L1 for deposits and synchronizing action states with the inner L2 account on commit.

## Operator Economics

:::warning
WIP: This section is under construction.
:::

- **Fees**: Users pay fees in MINA to the sequencer. The fees users pay are based on factors like computational work, DA, networking, and storage. The sequencer is paid fees for batch creation and proof aggregation work.
