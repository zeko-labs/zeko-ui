# Glossary

:::tip
Please refer to the [Mina Protocol Glossary](https://docs.minaprotocol.com/glossary) for more additional explanations of terms related to Mina and zkApps.
:::

## Account

On Mina, an account is uniquely identified by an account ID, which is a tuple of a public key and a token ID. Accounts can hold a balance of the native MINA token or a specific custom token (referred to as a **Token Account**). Accounts have associated permissions and state.
This is distinct from Bitcoin's UTXO model of maintaining ledger state.

## Account Update

A set of instructions for the Mina network. Every zkApp transaction on Mina is composed of one or more account updates. An account update can update only one account at a time. Its structure includes update, preconditions, and authorization parts. Account Updates can make assertions about their associated account, apply updates to it, and make assertions about their child AccountUpdates. They also specify any balance changes. Authorization can be `None`, `Signature`, or `Proof`, depending on the account's permissions.

## Actions

In Mina zkApps, actions act as a built-in, "append-only" off-chain storage layer. Used with the **Reducer** and a "lagging state" pattern to process concurrent state updates by multiple users. Actions are dispatched using the reducer's `dispatch` method. Communication from Layer 1 (L1) to Layer 2 (L2) in Zeko happens by posting actions to the zkApp account on L1. Account updates can be authorised by a proof to add an action. You can find more information in the [Actions & Reducer section](https://docs.minaprotocol.com/zkapps/writing-a-zkapp/feature-overview/actions-and-reducer) of the Mina docs.

## Blockchain

A decentralised digital ledger maintained by a distributed network of computers. Data is organised into chronologically arranged blocks secured by cryptography. Ensures data integrity through immutability via cryptography and consensus mechanisms. Transactions happen between users without intermediaries. Different types include public, private, and consortium blockchains.

## Consensus Mechanism

A set of rules that govern how nodes in a distributed network come to an agreement about the state of the blockchain and the validity of transactions. Ensures that all nodes in the network have the same copy of the ledger. Examples include **Proof of Work (PoW)** and **Proof of Stake (PoS)**.

## Cryptography

The science of using mathematical theories and computation to secure information. Essential for blockchain to maintain a secure, transparent, and tamper-resistant record. Includes techniques like hashing (converting data into a fixed-size string) and public-key cryptography (asymmetric cryptography for secure transactions).

## Custom Tokens

Tokens built on Mina using the `TokenContract` class. Supported at a low level in the Mina tech stack, treated almost like the native MINA token. Any account on Mina can have tokens associated with it. A **Token Manager Account** is a smart contract that sets the rules for minting, burning, and sending the custom token.

## Data Availability (DA) Layer

A crucial component of a rollup system responsible for storing all the transaction data that occurs on the rollup. Since the proof of a transaction batch doesn't reveal how to build the ledger's state, the DA layer is needed to prove that the necessary transaction data has been shared with everyone. In Zeko, the sequencer posts the transaction batch and receipts to the DA Layer. Zeko has a modular DA layer. Zeko currently uses a DA layer consisting of a multisig service with a few trusted parties, and aims to transition towards [Celestia](https://celestia.org/what-is-da/).

## Decentralisation

Information is stored across a network of computers (nodes) rather than a single central server. Refers to the distribution of control and decision-making power among users rather than a single entity. Decentralised networks are highly resistant to attacks.

## Layer 1 (L1)

The base layer or main chain of a blockchain network. In the context of Zeko, this refers to the Mina Protocol blockchain. Zeko settles batches of transactions on Layer 1. Communication from L1 to L2 (bridging) happens by posting **Actions** to the zkApp account on L1.

## Layer 2 (L2)

A scaling solution built on top of a **Layer 1** blockchain. Zeko is a Layer 2 ecosystem specifically designed for Mina's zkApps. Users interact with the **Sequencer** on L2. Zeko contains a nested Mina ledger as its L2 state. Communication from L2 to L1 happens via actions posted to a corresponding inner account on L2, which are synchronised on commit.

## Merkle Tree

A data structure that represents a set and provides an efficient way to prove that an element is included in the set. Used for the ledger in Mina because the ledger is a set of accounts. It serves a different purpose than the transaction snark binary tree used for batch proofs.

## Mina Protocol

A **Layer 1** blockchain known for its small, constant size due to recursive **Zero-Knowledge Proofs** (zk-SNARKs). Supports **zkApps** (zero-knowledge smart contracts). Offers infinite recursive proof construction through integration with the Pickles recursive system. Supports custom token functionality. The core idea is to offload transaction processing work from nodes by proving transactions off-chain on the client.

## Permissions

An integral part of zkApp development that determine who has the authority to interact with and make changes to a specific part of a smart contract. Set on an account's permissions field. **Account Updates** require authorisation (Proof, Signature, or None) that must meet the permissions set on the account. `Proof` authorisation is typically required for zkApps to change state, subtract money, or add actions, proving correct execution of a method.

## Proof of Stake (PoS)

A **Consensus Mechanism** where validators are chosen based on the amount of cryptocurrency they "stake" in the network. Used by newer blockchains like Ethereum.

## Proof of Work (PoW)

A **Consensus Mechanism** where miners compete to solve complex mathematical problems to add blocks to the blockchain. Used by Bitcoin. Requires significant computational power and energy.

## Prover / Verifier

In a **Zero-Knowledge Proof** system, the Prover is the party who wants to prove the truth of a statement. The Verifier is the party who verifies the proof without learning the secret information.

## Recursion

In the context of Mina and **zkApps**, refers to the ability to verify one zero-knowledge proof inside another, enabling recursive proof construction. Mina Protocol is the only blockchain offering infinite recursion. Used internally by Mina for its decentralised prover and sequencing mechanisms.

## Reducer

In o1js, an object declared on a smart contract used to take a list of **Actions** and reduce them. Currently has limitations for production applications with more than a hard-coded number of pending actions. Provides `dispatch` and `reduce` methods.

## Sequencer

In **Zeko**, the sequencer is a server responsible for collecting transactions, applying them to the ledger, posting them on the **Data Availability (DA) Layer**, proving them using zero-knowledge proofs, and sending a commit to the **Layer 1 (L1)**. Users send transactions directly to the sequencer. The sequencer verifies preconditions, permissions, and authorisations and aggregates transactions into batches, creating a single proof for the batch to send to L1.

## Smart Contract

A self-executing digital agreement written in code and stored on a blockchain. Operates without intermediaries. Defines the terms, rules, and conditions of an agreement. Once invoked and conditions are met, it executes automatically and immutably on the blockchain ledger. **zkApps** are zero-knowledge smart contracts on Mina.

## Token Account

See [**Account**](#account).

## Token ID

Unique identifiers that distinguish different types of custom tokens on Mina. Globally unique, derived from the zkApp that created the token. Derived from hashing the public key and token ID.

## Token Manager Account

See [**Custom Tokens**](#custom-tokens).

## Token Owner

The **zkApp** account that created, facilitates, and governs how a custom token can be used. This account is the only one that can mint, burn, or approve sending tokens.

## TokenContract Class

The base class for creating **Custom Tokens** on Mina. Includes internal helper methods for core token operations like minting, burning, and sending.

## Transaction Snark

In Mina/Zeko, used to prove the transition from one ledger state to another. Individual transactions or account updates form the leaves of a binary tree, which are merged into a root snark that proves the whole batch. Primarily used for compressing the computation of validating a batch of transactions into verifying a single snark.

## Zero-Knowledge Proof (ZKP)

A cryptographic technology allowing verification of a statement's truth without revealing the statement itself. A method where a **Prover** convinces a **Verifier** they know something, without revealing the information. Requires completeness (property allowing an honest prover to construct a valid proof) and soundness (preventing the adversary to construct a valid proof). Used for privacy and security in digital transactions.

- **zk-SNARKs**: zkSNARK is a zero knowledge succinct non-interactive argument of knowledge. It is a specific zero knowledge proof construction that works great for blockchain use cases. Succinct means that verifying of proof is cheaper than doing the calculation itself so it's great for scaling use cases, non-interactive means that prover can just upload the proof to the blockchain and it can be verified without any interaction with the prover and argument of knowledge, is a proof that not only something is true, but I am proving that I also know a witness. An example of would be proving that there exists a private key to some public key - that is trivial proof because every public key has a private key. Argument of knowledge would be to prove that I also know the private key. All of these properties are needed for the zk proofs to be viable for blockchain usecases.
- **zk-STARKs**: A different type of ZKP, zkSTARKs are technically also zkSNARKs with a different tradeof: usually without trusted setup, with post-quantum safety and faster proving time, however they usually have bigger proof sizes and slower verification time.

## Zeko

A **Layer 2 (L2)** ecosystem built on Mina Protocol, specifically for **zkApps**. It aims to provide improved throughput and quick confirmation times. Zeko is implemented as a zkApp on Mina's **Layer 1**, containing a nested Mina ledger within its account state. It reuses most of Mina's tooling and transaction snarks. Benefits include enhanced scalability, rapid finality, developer-friendliness, and interoperability. Supports a modular architecture for custom **zkRollups**.

## zkApp

A zkApp is a zero-knowledge smart contract on Mina Protocol. These smart contracts leverage zero-knowledge proofs to ensure correct state transitions, allowing transactions to be proven off-chain and verified without revealing private data. They are primarily about proving the correct execution of the smart contract logic. zkApps on Mina enable the creation of arbitrary programs using zero-knowledge cryptography. They allow for programmable privacy and offer constant verification time for transactions. They can be built to interact with tokens, such as swapping or depositing MINA. When interacting with a zkApp, certain actions, like changing state or adding actions, require authorisation via a proof that you've correctly executed one of the contract's methods. Each zkApp transaction is composed of one or more account updates. For more information, see the [zkApps section](https://docs.minaprotocol.com/zkapps/writing-a-zkapp) of the Mina docs.

## ZkProgram

A construct in o1js used to define the steps of a recursive program. Methods execute off-chain. Can be embedded within a **Smart Contract** method to verify the proof of execution. Also used to prove and verify arbitrary zero knowledge programs.

## zk-Rollup

A **zk-rollup** is a **Layer 2 scaling solution** for blockchain networks. Its primary purpose is to **increase transaction throughput** while maintaining security. This is achieved by **bundling ("rolling up") many off-chain transactions** into a single transaction. A **Zero-Knowledge Proof (ZKP)** is generated for this batch, which attests to the validity of all the transactions within the bundle. This single transaction and its proof are then submitted and verified on the main blockchain (Layer 1), significantly reducing the amount of data processed on-chain and leading to **faster and cheaper transactions**.
