# Zeko Core Concepts

_Zeko is designed as a Layer 2 (L2) ecosystem specifically for Mina's zero-knowledge applications, known as zkApps. It aims to provide a robust platform for building and deploying zkApps with significantly improved throughput and quick confirmation times compared to the Layer 1 (L1) Mina protocol._

## How Zeko Achieves Scalability: The Rollup Mechanism

At its core, Zeko functions as a **ZK Rollup**. This means it processes transactions off-chain, bundles them into batches, and then commits a cryptographic proof of the batch's validity to the Mina L1 chain.

The **sequencer** is a key component in this process, acting as a transaction collector that gathers transactions and applies them to the current state. It groups these transactions into **batches** for efficient settling on L1. The sequencer then proves the validity of these batches using zero-knowledge proofs. A root SNARK proof representing the batch is created, which is then committed to the L1 zkApp's account state.

This process leverages **transaction SNARKs**, which prove the transition from one ledger state to another. These proofs are composed into a binary tree structure. The root SNARK of this tree serves as a proof for the entire batch and the constant size of this proof is how Zeko compresses the computation of validating a batch of transactions. This offloads work from the main network nodes, a fundamental idea behind Mina. By committing a single, constant-size proof to L1, Zeko significantly increases transaction throughput.

```d2
direction: down

# Style classes
classes: {
  root-proof: {
    style.fill: "#28a745"
    style.stroke: "#1e7e34"
    style.font-color: "white"
  }
  intermediate-proof: {
    style.fill: "#ffc107"
    style.stroke: "#d39e00"
    style.font-color: "white"
  }
  tx-proof: {
    style.fill: "#17a2b8"
    style.stroke: "#117a8b"
    style.font-color: "white"
  }
}

# Binary Tree of Transaction Proofs
tree: Binary Tree of Proofs {
  style.fill: "#f8f9fa"

  root: Root SNARK\nState A->E { class: root-proof }
  
  level1_left: Intermediate Proof\nState A->C { class: intermediate-proof }
  level1_right: Intermediate Proof\nState D->E { class: intermediate-proof }
  
  tx1: Tx SNARK 1\nState A->B { class: tx-proof }
  tx2: Tx SNARK 2\nState B->C { class: tx-proof }
  tx3: Tx SNARK 3\nState C->D { class: tx-proof }
  tx4: Tx SNARK 4\nState D->E { class: tx-proof }
  
  # Tree connections
  level1_left -> root
  level1_right -> root
  tx1 -> level1_left
  tx2 -> level1_left
  tx3 -> level1_right
  tx4 -> level1_right
}

# L1 Commitment
l1: Mina L1 {
  style.fill: "#e8f4fd"
  zkapp: zkApp Account {
    state: Rollup State
  }
}

tree.root -> l1.zkapp: Commits Root Proof
```

## The Role of Zero-Knowledge Proofs in Zeko

Zero-knowledge proofs (ZKPs) are fundamental to Zeko, as they are to Mina and zkApps. They allow one party (the prover) to convince another party (the verifier) that a statement is true without revealing any information beyond the truth of the statement itself.

In Zeko, ZKPs, specifically zk-SNARKs, are used for two primary purposes in transaction processing:

1. **Compressing Computation**: The **transaction SNARKs** compress the validation of a batch of transactions into the verification of a single proof.
2. **Proving Correct Execution**: zkApps on Mina (and thus Zeko) are primarily about proving that you have correctly executed the smart contract logic. The client first executes the smart contract function off-chain and then generates a proof that this execution was performed correctly.

While zk-SNARKs _can_ be used to hide parts of transaction data, the primary use in zkApps on Mina/Zeko is proving correct execution and compressing computation. Hiding data is considered a side product. These proofs must satisfy **completeness** (an honest prover can demonstrate knowledge) and **soundness** (a dishonest prover cannot convince the verifier) without revealing the sensitive information itself.

Mina and Zeko benefit from the underlying **recursive proof system** ([Kimchi backed by Pickles](https://www.o1labs.org/blog/reintroducing-kimchi)), which enables arbitrary infinite recursive proof construction. This recursive capability is used internally within Mina for decentralized proving and sequencing and allows for the creation of tree-based recursive programs like the one used in the rollup aggregation.

> [!TIP] 💡 ZK Rollups 💡
> Zk-rollups utilize ZKPs to ensure the validity of all transactions in a bundled batch without necessarily disclosing the specifics of each transaction, which can enhance privacy.

## zkApps: Zeko's Smart Contracts

On Mina and Zeko, smart contracts are referred to as **zkApps** or **zkApp accounts**. While the languages of the circuits is ocaml, the [o1js](https://docs.o1labs.org/o1js/) library can be used, to develop zkApps using Typescript.

zkApps are zero-knowledge smart contracts that leverage ZKPs to ensure the correctness of state transitions. Developers write these contracts using the `SmartContract` class in o1js.

Additionally, o1js provides the `ZkProgram()` construct, which is used to define the steps of **recursive programs**. Unlike `SmartContract` methods, `ZkProgram()` methods execute off-chain. These off-chain computations can take private inputs, which are not seen by the Mina network. After performing the desired recursive steps off-chain, the proof of execution generated by the `ZkProgram` can be verified _on-chain_ within a `SmartContract` method. This allows the results or outputs of complex off-chain computations to be trustlessly verified and used, for example, to update the zkApp's on-chain state.

> [!NOTE] zkProgram and SmartContract
> While the primary on-chain logic of a zkApp is defined within the `SmartContract` class, the ability to define and verify `ZkProgram`s provides a powerful way to perform arbitrary zero-knowledge programs or circuits off-chain and settle their validity on-chain.

## State Management

Zeko operates as a nested instantiation of the Mina ledger within a zkApp account on the Mina L1 chain. This creates a dual-layer architecture where the L1 zkApp account serves as the **'outer' account** that tracks the state of a corresponding **'inner' account** on the L2.

```d2
direction: down

L1: Mina L1 {
  style.fill: "#e8f4fd"
  outer: Outer Account {
    state: L2 Hash
  }
}

L2: Zeko L2 {
  style.fill: "#f0f8e8"
  inner: Inner Account {
    ledger: L2 State
  }
  sequencer: Sequencer
}

L2.sequencer -> L1.outer: Batch Proof
L1.outer <-> L2.inner: Actions
```

### Account Updates: The Transaction Building Blocks

All transactions on Mina and Zeko are built from **Account Updates** - the fundamental data structure that instructs the network on state changes. Each `AccountUpdate` can alter on-chain state, emit events, change permissions, or modify balances. These updates include **preconditions** that must be satisfied, specify the exact **updates** to apply, define **balance changes**, and require appropriate **authorization** (typically a proof for zkApps).

### L2 State Transitions and Batch Proving

The Zeko sequencer manages L2 state by collecting transactions composed of **Account Updates** and applying them to the ledger off-chain. Rather than processing transactions individually, the sequencer batches them together and generates a **proof** demonstrating the validity of the cumulative state transition. This root proof is then submitted to the L1 Mina chain, updating the outer zkApp's state to reflect the new L2 ledger hash and effectively committing the **entire batch** to L1.

### L1/L2 Communication Through Actions

Synchronization between the outer and inner accounts occurs via Mina's **action** system. Actions are public data attached to transactions that can be processed by smart contracts using reducers. The network maintains an **actionState** - a cryptographic commitment to the history of dispatched actions - ensuring processed actions were genuinely sent to the contract.

Communication flows _bidirectionally_: L1 to L2 communication involves posting actions to the L1 zkApp account, while L2 to L1 communication posts actions to the L2 inner account. During the commit process (when batch proofs are posted to L1), the action states of both accounts **synchronize**, maintaining consistency across layers.

When action states are synchronised, anybody can prove on **each layer** that their action has been included using a simple Merkle proof.

This architecture enables Zeko to process transactions **efficiently** off-chain while leveraging Mina's recursive proof system to compress validation and maintain the security guarantees of the L1 chain.
