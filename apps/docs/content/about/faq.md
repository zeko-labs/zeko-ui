# Frequently Asked Questions (FAQ)

Here are answers to common questions about Zeko, Mina, and related concepts.

## General Zeko Questions

- **What is Zeko?**
  Zeko is a Layer 2 (L2) ecosystem designed specifically for **Mina's zero-knowledge applications (zkApps)**. It provides developers with a robust platform to build and deploy zkApps with improved throughput and quick confirmation times. Zeko is meant to be a zkApp that contains a nested Mina ledger in its account state.

- **What are the benefits of building on Zeko?**
  Key benefits include **enhanced scalability** (faster throughput than Layer 1 Mina), **rapid finality** (instant confirmation), **developer-friendliness** (seamless compatibility with Mina tools), and **interoperability** (seamless bridging to Layer 1).

- **How is Zeko different from other Layer 2 solutions?**
  Zeko offers **seamless tooling integration**, meaning existing Mina developer tools, libraries, and even front-end browser wallets work out-of-the-box. Developers familiar with Mina can immediately begin building on Zeko without a steep learning curve, allowing for **rapid onboarding**. Zeko developers also benefit from the shared community and resources of the active Mina community.

- **What kinds of applications can be built on Zeko?**
  A variety of applications can be built on Zeko, such as **decentralized exchanges (DEXs)**, **privacy-focused gaming platforms**, **scalable social media protocols**, and **anonymous identity solutions**, among many others.

- **Can Zeko networks be customized?**
  Yes, Zeko's modular architecture allows you to create your own **custom rollup network** with tailored specifications. This enables application-specific optimization, control over security and governance, and acts as an innovation sandbox for experimenting with new ideas or consensus models without impacting the wider Zeko ecosystem.

## Core Concepts: zkApps, Smart Contracts, Proofs

- **What is a zkApp?**
  A zkApp is a **zero-knowledge smart contract on Mina Protocol**. These smart contracts use zero-knowledge proofs to correct state transitions, enabling transactions to be proved off-chain and verified without revealing private data. A zkApp account is essentially a smart contract on Mina.

- **What is a Smart Contract?**
  A smart contract is a **self-executing digital agreement** written in code and stored on a blockchain. They automate and enforce contract terms without needing intermediaries, leveraging blockchain technology for security and transparency. Smart contracts are particularly useful for parties to transact directly.

- **How do zkApps leverage Zero-Knowledge Proofs (ZKPs)?**
  ZKPs allow a prover to convince a verifier that a statement is true without revealing any information beyond the truth of the statement itself. In the context of zkApps on Mina and Zeko, ZKPs (specifically zk-SNARKs) are used for **compressing computation** and proving that a smart contract function was executed correctly. They can also be used to hide parts of the transaction data. Mina Protocol is powered by a multi-tiered recursive zkSNARK proof that is small and constant in size.

- **What is Recursion in Mina/Zeko?**
  Mina's custom proof system, Kimchi, supports arbitrary infinite recursive proof construction through integration with the Pickles recursive system. **Mina Protocol is the only blockchain that offers infinite recursion**. This recursion can be used to verify any zero-knowledge program as part of your zkApp. In o1js, you can use `ZkProgram()` to define the steps of a recursive program. Recursion is used internally within Mina as part of its decentralized prover and sequencing mechanism for rollups and is robustly supported by Kimchi.

- **What is a zk-Rollup?**
  A zk-rollup is a **Layer-2 scaling solution** that increases blockchain transaction throughput without compromising security. They bundle ("roll up") many off-chain transactions into a single transaction, which is then verified and recorded on the main chain. The "zero-knowledge" aspect refers to using ZKPs to ensure the validity of all transactions in the batch without revealing their specifics. Zeko is described as a ZK Rollup on top of Mina.

- **What is the Zeko Sequencer?**
  The sequencer is described as Zeko's "Transaction Powerhouse" or the "conductor of an orchestra". It is a server that performs several key roles:
  1. **Transaction Collector**: Gathers transactions and applies them to the current state.
  2. **Proof Verifier/Prover**: Proves the validity of transactions using zero-knowledge proofs. It proves that it has verified preconditions/permissions/authorization and correctly applied the transaction to the ledger.
  3. **Batch Processor**: Groups transactions into batches.
  4. **Layer 1 Bridge**: Sends ready batches to the main chain (Layer 1) via a smart contract to keep Layer 1 informed.
     The sequencer accepts transactions via GraphQL.

- **What is Data Availability (DA)?**
  Data availability is the concept of ensuring that the required data to build the ledger's state (transactions) are shared with everyone. The proof of a transaction batch doesn't reveal how the ledger state is built, so DA is needed to prove that the necessary data has been shared, otherwise, the rollup could be stalled. It is a critical component of any rollup system, responsible for storing all transaction data that occurs on the rollup.

- **How does Zeko handle Data Availability?**
  Zeko has a **modular Data Availability (DA) layer**. Sequencers post finished batches and receipts to the DA layer. This DA layer ensures that data has been broadcast, making it recoverable by all participants. Zeko currently uses a temporary DA-layer, a fork of an EVM chain with instant finality consensus. In the future, multiple sequencers may use the DA layer as a shared sequencing pool.

## Developer Concepts

- **What are Account Updates?**
  An AccountUpdate is a **set of instructions for the Mina network**. Each `AccountUpdate` can make assertions about its account, apply updates, and make assertions about its child `AccountUpdates`. Transactions are structured as a list of trees of `AccountUpdates`. Permissions, preconditions, composability, and tokens are core features implemented using `AccountUpdates`. An account update includes an update part, preconditions part, and authorization part. An account update can only update one account. A transaction might consist of multiple account updates, e.g., one to subtract an amount and one to add an amount.

- **What are Permissions?**
  Permissions are integral to zkApp development as they determine **who has the authority to interact and make changes** to a specific part of a smart contract. Different types of permissions exist for actions like changing the `zkappUri`, editing the actions state, setting the token symbol, sending MINA, setting the verification key for upgradeability, and more. Common permission types include `none` (always permitted), `signature` (permitted by the private key owner), and `proof` (permitted by a zkApp proof from executing a method). Permissions can be mixed. For zkApps, often permission is set to `proof` so that only transactions fulfilling the smart contract logic can update the state. Special `VerificationKeyPermission` types exist for upgradeability that depend on the transaction version.

- **What are Actions and Reducers?**
  Using actions and a "lagging state" pattern, zkApps can **process concurrent state updates by multiple users**. Actions act as a built-in, "append-only" off-chain storage layer. To use actions, you declare a `reducer` object on the smart contract. A reducer takes a list of actions and reduces them into a single state. Smart contracts can dispatch actions. The "action state" is Mina's way of solving concurrency in smart contracts. **Note**: The reducer API in o1js is currently not production-safe due to a limitation in the `reduce()` method breaking if more than a hard-coded number (default: 32) of actions are pending.

- **How do Custom Tokens work on Mina/Zeko?**
  Mina supports custom token functionality at a low level in the tech stack, treating them almost the same way as the native MINA token. This reduces boilerplate, means developers don't need to track accounts and balances themselves, and is more secure. Each account on Mina can have tokens associated with it. A token manager smart contract uses the `TokenContract` class and sets rules for minting, burning, and sending the custom token. **Minting** generates new tokens and adds them to an account's balance. **Burning** deducts tokens from an account's balance. **Sending** tokens between accounts must be approved by a zkApp. The `TokenContract.internal` namespace provides `mint`, `burn`, and `send` helper methods. Custom tokens are identified by a unique **Token id** derived from the zkApp, which is globally unique. **Token accounts** hold a balance of a specific custom token and are specified by a public key _and_ a token id. The **Token Owner** is the zkApp account that created the token and is the only one that can mint, burn, or approve sending tokens.

- **Are Mina and Zeko Developer Tools Compatible?**
  Zeko is mostly isomorphic to Mina, meaning you can use the **same tools and libraries** to develop zkApps as you would for Mina. Developers familiar with Mina can start building on Zeko immediately.

## User Information

- **Is there a faucet for Zeko-M testnet?**
  Yes, there is a faucet available at https://zeko.io/faucet.

## Transaction Flow on Zeko

- **What happens after I send a transaction on Zeko?**
  1. You send the transaction (which includes `AccountUpdate`s) and its corresponding proof directly to the **sequencer**. On the client side, you first execute the smart contract function and then prove that you executed it correctly. The `proveTransaction` step is about proving correct execution, not primarily hiding data.
  2. The sequencer receives the transaction.
  3. The sequencer applies the transaction to the ledger.
  4. The sequencer verifies some aspects of the transaction, such as preconditions, permissions, and that the proof/signature is valid.
  5. The sequencer sends the transaction to the **Data Availability (DA) layer**. The DA layer consists of nodes replicating the same storage. This is where the individual transaction data (A, B, C, D) is sent.
  6. The sequencer sends the transaction to a **prover**. This prover is needed to prove that the sequencer correctly verified the additional checks (preconditions/permissions/authorization) and applied the transaction correctly to the ledger, showing the state transition from Ledger A hash to Ledger B hash.
  7. The sequencer accepts many transactions (e.g., A->B, B->C, C->D) and proves them, creating a **binary tree of proofs** until it has a single aggregated proof (e.g., A->D). This binary tree is not a Merkle tree. A transaction snark proves the transition from ledger A to ledger B. This proof compresses the validation of the whole batch of transactions into verification of a single snark.
  8. The aggregated proof (e.g., A->D) is then sent to **Layer 1 (Mina)**. The zkApp's state on L1 gets updated to the new ledger hash (e.g., D). You send only the proof to L1, not the individual transactions. The proof is a constant size, achieving computation compression.
  9. On L1, the aggregated proof is verified. If valid, the zkApp's state (which includes the current ledger hash) is updated.

- **What are Preconditions?**
  Preconditions are conditions that must be true for an account update to be applied. These correspond to assertions made within an o1js method. For example, a precondition can assert the nonce of an account so a deployment transaction cannot be applied more than once. Network preconditions are not currently supported in Zeko, though a subset allowing checking the ledger hash might be supported in the future. Time preconditions are supported in Zeko.

- **What is the difference between a Transaction Snark and a zkApp ZkSnark?**
  Both are types of ZkSnarks. A **zkApp ZkSnark** can be used to hide parts of the data. The **transaction snark** primarily uses the compression property of ZkSnarks to compress the validation of a whole batch of transactions into verifying one snark. If you hear just "snark", it likely means the zero-knowledge property (hiding) is not the primary focus.

- **How are Zeko and Mina ledgers related?**
  Zeko's internal design aims to be a zkApp that contains a **nested Mina ledger** in its account state. Transfers of MINA between the "outer" (L1) and "inner" (L2) ledgers should be possible. The core rollup protocol doesn't handle transfer of value/MINA directly. There is a special account on L1 (outer) and a corresponding inner account on L2 that are part of the bridge between Mina and Zeko, used to sync states. Synchronization refers to syncing from L1 to L2, and Commit refers to syncing from L2 to L1.
