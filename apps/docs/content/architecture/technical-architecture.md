# Technical Architecture

This section details the core components and processes that make up the Zeko rollup, explaining how transactions are handled, proved, and committed to the Layer 1 (L1) Mina blockchain.

## Zeko Internal Design

Zeko is meant to be a zkApp that contains a nested Mina ledger in its account state. Transfers of Mina (only, for now) between the outer and inner ledgers should be possible. These are the only goals for the MVP.

The design is meant only to do this as well as possible. The MVP zkApp neither has any data availability checks to ensure that the witnesses necessary to operate on the zkApp are available in the network.

### Circuits

- Outer circuit (for L1 zkApp)
- Inner circuit (for handling transfers on the L2 side cleanly)
- Transaction wrapper circuit (for wrapping transaction snarks)
- Action state extension circuit (for proving one action state is an extension of another)
- Helper token owner circuit for recording transfers processed

### zkApp design

The L1 and L2 are connected by a special account on the L2, denoted by having a special public key. The L1 account is called the outer account, and the L2 one the inner account.

The outer account keeps track of the ledger hash of the inner ledger, the hash of the merkle list for all withdrawals (L2 -> L1). Actions on the outer account are treated as deposits (L1 -> L2).

The inner account keeps track, similarly, of all deposits.

Updating the ledger hash can be done via supplying a valid ledger transition, i.e. transaction snark.

The inner account must start with the maximum amount of Mina possible when the rollup is made. When a deposit happens, an action is added to the outer account, along with MINA. On the inner side the recipient can finalize the deposit, taking the MINA from the L1 account.

For withdrawals (L2 -> L1), the same happens in reverse.

Processing transfers
The central problem we face is that we can not send MINA trivially. MINA accounts may have `receive != None`, and we can not prevent them from emptying their accounts, meaning the sequencer's submitted transaction would fail, DoSing the rollup.

There are ways to solve this with `receipt_chain_hash`, but

1. They are complicated.
2. They can not work well when the `set_verification_key` permission is `Signature` or `Either`.

We opt to instead push this responsibility onto the user. The user can finalize the transfer if they can prove it hasn't happened before. In a sense, we're delegating the responsibility of storing this state to the user, and must enforce they store it correctly. We can do it through token accounts, with a token owner that only allows storing valid data. We can do it by checking `receipt_chain_hash` at transfer-processing time. We can also use simpler indicators, such as `is_new`, after all, a new account can not have processed any transfers before!

### Token approach

A transfer has two stages:

1. Submission (add action)
2. Processing (move funds from Zeko account to user account)

During the processing, we must prove that we haven't processed the transfer already, by including a helper account specific to the recipient. The helper account tracks the action state at the time of the last transfer processing. The account update for the inner/outer account includes this as a child, and updates the action state to the current one. A proof that the actions between these two action states, filtered by recipient, total to the amount, must be included. If the account is new, the action state is regarded as being the empty action state.

In essence, we are tracking per-recipient what transfers have been processed. We delegate the responsibility of this to the recipient themself. How do we prevent them from tampering with the data? We make the account have a special token id, which circuit only allows transactions in which they are subordinate to the inner/outer account.

Thus, they can never make an update which isn't also underneath the inner/outer account.

To simplify this, we make the inner/outer account the token owner, removing the need for tracking the public key of the token owner.

> [!TIP]
> If you are interested in reading more of internal design, please refer to the [white paper](https://docsend.com/view/f9a6kgdr4tjwuqng).

Okay, here is the section "3.2 Technical Architecture" formatted in GitHub Flavored Markdown, drawing upon the information provided in the sources.

## Detailed Component Breakdown

Zeko functions as a **zkApp account** on Mina Protocol. It is designed to be a nested instance of the Mina ledger on top of itself. This architecture involves several key components working together:

- **Sequencer:** The sequencer is described as Zeko's "Transaction Powerhouse" and acts like the conductor of an orchestra. Its primary roles include:
  - Acting as a **Transaction Collector**, gathering transactions submitted by users.
  - Applying these transactions to the current state of the L2 ledger.
  - Acting as a **Proof Verifier**, proving the validity of transactions using zero-knowledge proofs to ensure only legitimate transactions enter the system. It verifies aspects such as preconditions, permissions, proof/signature validity, and correct authorization.
  - Acting as a **Batch Processor**, efficiently grouping transactions into batches instead of processing them one by one.
  - Acting as a **Layer 1 Bridge**, sending ready batches to the L1 Mina chain via a smart contract to keep L1 informed of activity on Zeko.
  - Posting applied transactions to the Data Availability (DA) layer.
  - Sending transactions to the provers.
  - Aggregating individual transaction proofs into a single proof for the batch. This is done by creating a binary tree of proofs, merging proofs for distinct transactions.
  - Accepting user transactions directly via a GraphQL API.

- **Prover:** The prover is a component that proves the validity of transactions processed by the sequencer. Transaction snarks are used to prove the transition from one ledger state (Ledger A) to another (Ledger B). The sequencer sends transactions to one of the provers, and the prover generates the necessary proofs. While the client generates a proof for executing the zkApp logic, the sequencer also sends the transaction to a prover to prove the additional checks it performed, such as verifying preconditions, permissions, and authorizations, and proving that the transaction was applied correctly to the ledger.

- **Verifier Smart Contract on Mina (L1 Rollup Contract):** Zeko is implemented as a zkApp account on the L1 Mina blockchain. The state of this L1 zkApp stores the current hash of the Zeko ledger. The sequencer sends the aggregated proof of a batch of transactions to this L1 contract. This proof encapsulates the state transition of the L2 ledger (e.g., from hash A to hash D). The L1 contract verifies this proof, and if valid, updates its state to the new ledger hash, effectively committing the batch of L2 transactions to L1.

## Data Availability Layer

A **data availability layer (DAL)** is a critical component for any rollup system, responsible for storing all the transaction data that occurs on the rollup. The reason for a DA layer is that the proof of a transaction batch does not reveal the specific transactions or how the ledger's state was constructed. Therefore, it is necessary to prove that the required data (the transactions themselves) has been shared with everyone. This prevents the rollup from being stalled by operators withholding necessary data.

Zeko employs a **modular DA-layer**. Currently, Zeko uses a temporary DA-layer built on a fork of the EVM chain Ethermint, which offers instant finality consensus. Data availability in Zeko is ensured by requiring a public key to sign the hashes used. The sequencer posts both the batch of transactions and associated receipts to the DA layer. A DA layer guarantees that data has been broadcast and verified by a sufficient number of participants. The DA layer should eventually be usable by L1 apps and L2s.

## Transaction Lifecycle

The process of a user transaction on Zeko involves several steps, from initiation to final commitment on the Mina L1 chain:

1. **User Initiation:** A user initiates a transaction, for example, to mint tokens using a zkApp. This involves generating **account updates**, which are sets of instructions for the ledger.
2. **Client-Side Proving:** The user's client executes the zkApp logic and generates a zero-knowledge proof attesting to the correct execution of the smart contract function. This offloads computation from the network nodes.
3. **Submission to Sequencer:** The user sends the transaction and the generated proof directly to the Zeko sequencer, typically via a GraphQL API endpoint.
4. **Sequencer Processing (Verification and Application):** The sequencer accepts the transaction. It verifies certain aspects like preconditions, required permissions, and the validity of the provided proof or signature. If valid, the sequencer applies the account updates and the transaction to the L2 ledger state.
5. **Data Availability Posting:** The sequencer sends the transaction data to the Data Availability layer. The DA layer consists of nodes that replicate this data storage.
6. **Proving (Sequencer-Initiated):** The sequencer sends the transaction to a prover to generate proofs for the work the sequencer performed (e.g., verifying preconditions and applying the transaction to the ledger).
7. **Batching:** The sequencer groups multiple processed transactions into a batch.
8. **Batch Proof Aggregation:** The sequencer aggregates the individual proofs for the transactions within the batch into a single, constant-sized proof using a binary tree structure. This aggregated proof summarizes the state transition from the beginning to the end of the batch (e.g., Ledger A hash to Ledger D hash).
9. **Commitment to L1:** The sequencer sends the aggregated batch proof to the L1 Mina blockchain. This proof is verified by the Zeko zkApp (rollup contract) on L1.
10. **L1 State Update:** Upon successful verification of the batch proof, the L1 Zeko zkApp updates its on-chain state to the new ledger hash, thereby finalizing and committing the batch of L2 transactions to the Layer 1 blockchain.

The full transaction data for the batch is sent to the DA layer, while only the constant-sized aggregated proof is sent to L1. Zeko's architecture includes mechanisms like an archive relay adapter that can subscribe to the sequencer and relay new blocks to a standard Mina archive node for historical indexing.
