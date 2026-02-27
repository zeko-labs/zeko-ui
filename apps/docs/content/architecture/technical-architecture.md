# Technical Architecture

_This section details the core components and processes that make up the Zeko rollup, explaining how transactions are handled, proved, and committed to the Layer 1 (L1) Mina blockchain._

## Detailed Component Breakdown

Zeko functions as a **zkApp account** on Mina Protocol. It is designed to be a _nested instance_ of the Mina ledger on top of itself. This architecture involves several key components working together:

### Sequencer

The sequencer primary roles include:

- Acting as a **Transaction Collector**, gathering transactions submitted by users.
- Applying these transactions to the current state of the L2 ledger.
- Acting as a **Proof Verifier**, proving the validity of transactions using _zero-knowledge proofs_ to ensure only legitimate transactions enter the system. It verifies aspects such as **preconditions**, **permissions**, **proof/signature validity**, and correct authorization.
- Acting as a **Batch Processor**, efficiently grouping transactions into _batches_ instead of processing them one by one.
- Acting as a **Layer 1 Bridge**, sending ready batches to the L1 Mina chain via a smart contract to keep L1 informed of activity on Zeko.
- Posting applied transactions to the **Data Availability (DA)** layer.
- Sending transactions to the **provers**.
- Aggregating individual transaction proofs into a _single proof_ for the batch. This is done by creating a **binary tree of proofs**, merging proofs for distinct transactions.
- Accepting user transactions directly via a **GraphQL API**.

### Prover

The prover is a component that proves the validity of transactions processed by the sequencer. **Transaction snarks** are used to prove the transition from one ledger state (Ledger A) to another (Ledger B). The sequencer sends transactions to one of the provers, and the prover generates the necessary proofs. While the client generates a proof for executing the _zkApp logic_, the sequencer also sends the transaction to a prover to prove the additional checks it performed, such as verifying **preconditions**, **permissions**, and **authorizations**, and proving that the transaction was applied correctly to the ledger.

### Verifier Smart Contract on Mina (L1 Rollup Contract)

Zeko is implemented as a **zkApp account** on the L1 Mina blockchain. The state of this L1 zkApp stores the current _hash of the Zeko ledger_. The sequencer sends the **aggregated proof** of a batch of transactions to this L1 contract. This proof encapsulates the **state transition** of the L2 ledger (e.g., from hash A to hash D). The L1 contract verifies this proof, and if valid, updates its state to the new ledger hash, effectively _committing the batch_ of L2 transactions to L1.

### Archive

Zeko's architecture includes mechanisms like an **archive relay adapter** that can subscribe to the sequencer and relay new blocks to a standard Mina archive node for _historical indexing_.

## Data Availability Layer

A **data availability layer (DAL)** is a critical component for any rollup system, responsible for storing all the transaction data that occurs on the rollup. The reason for a DA layer is that the _proof of a transaction batch_ does not reveal the specific transactions or how the ledger's state was constructed. Therefore, it is necessary to prove that the required data (the transactions themselves) has been shared with everyone. This prevents the rollup from being stalled by operators _withholding necessary data_.

Zeko employs a **modular DA-layer**. Currently, Zeko uses a temporary DA-layer built on _multisig services_ with a few trusted parties, and is transitioning towards [Celestia](https://docs.celestia.org/learn/how-celestia-works/data-availability-layer). Data availability in Zeko is ensured by requiring a **public key** to sign the hashes used. The sequencer posts both the _batch of transactions_ and associated **receipts** to the DA layer. A DA layer guarantees that data has been broadcast and verified by a sufficient number of participants. The DA layer should eventually be usable by _L1 apps and L2s_.

## Transaction Lifecycle

The process of a user transaction on Zeko involves several steps, from initiation to final commitment on the Mina L1 chain:

```d2
grid-rows: 4
grid-columns: 3
horizontal-gap: 20
vertical-gap: 20

# First row - 3 steps (1→2→3) - Client
0,0: "1. User Initiation" {
  shape: rectangle
  style.fill: "#5098f6"
  style.font-color: "white"
}

0,1: "2. Client-Side Proving" {
  shape: rectangle
  style.fill: "#5098f6"
  style.font-color: "white"
}

0,2: "3. Submission to Sequencer" {
  shape: rectangle
  style.fill: "#5098f6"
  style.font-color: "white"
}

# Second row - 2 steps (5←4) - Transition
1,0: "" {
  style: {
    fill: transparent
    stroke: transparent
  }
}

1,1: "5. Data Availability Posting" {
  shape: rectangle
  style.fill: "#c19432"
  style.font-color: "white"
}

1,2: "4. Sequencer Processing" {
  shape: rectangle
  style.fill: "#c19432"
  style.font-color: "white"
}

# Third row - 3 steps (6→7→8) - L2
2,0: "6. Proving (Sequencer-Initiated)" {
  shape: rectangle
  style.fill: "#c19432"
  style.font-color: "white"
}

2,1: "7. Batching" {
  shape: rectangle
  style.fill: "#c19432"
  style.font-color: "white"
}

2,2: "8. Batch Proof Aggregation" {
  shape: rectangle
  style.fill: "#c19432"
  style.font-color: "white"
}

# Fourth row - 2 steps (9→10) - L1
3,0: "" {
  style: {
    fill: transparent
    stroke: transparent
  }
}

3,1: "10. L1 State Update" {
  shape: rectangle
  style.fill: "#3da45d"
  style.font-color: "white"
}

3,2: "9. Commitment to L1" {
  shape: rectangle
  style.fill: "#3da45d"
  style.font-color: "white"
}

# Flow connections following the new snail pattern
0,0 -> 0,1 -> 0,2 -> 1,2 -> 1,1 -> 2,0 -> 2,1 -> 2,2 -> 3,2 -> 3,1
```

1. **User Initiation:** A user initiates a transaction, for example, to mint tokens using a zkApp. This involves generating **account updates**, which are sets of instructions for the ledger.
2. **Client-Side Proving:** The user's client executes the _zkApp logic_ and generates a **zero-knowledge proof** attesting to the correct execution of the smart contract function. This _offloads computation_ from the network nodes.
3. **Submission to Sequencer:** The user sends the transaction and the generated proof directly to the Zeko sequencer, typically via a **GraphQL API** endpoint.
4. **Sequencer Processing (Verification and Application):** The sequencer accepts the transaction. It verifies certain aspects like **preconditions**, required **permissions**, and the validity of the provided _proof or signature_. If valid, the sequencer applies the account updates and the transaction to the **L2 ledger state**.
5. **Data Availability Posting:** The sequencer sends the transaction data to the **Data Availability layer**. The DA layer consists of nodes that _replicate this data storage_.
6. **Proving (Sequencer-Initiated):** The sequencer sends the transaction to a **prover** to generate proofs for the work the sequencer performed (e.g., verifying preconditions and applying the transaction to the ledger).
7. **Batching:** The sequencer groups multiple processed transactions into a **batch**.
8. **Batch Proof Aggregation:** The sequencer aggregates the individual proofs for the transactions within the batch into a _single, constant-sized proof_ using a **binary tree structure**. This aggregated proof summarizes the **state transition** from the beginning to the end of the batch (e.g., Ledger A hash to Ledger D hash).
9. **Commitment to L1:** The sequencer sends the **aggregated batch proof** to the L1 Mina blockchain. This proof is verified by the **Zeko zkApp** (rollup contract) on L1.
10. **L1 State Update:** Upon successful verification of the batch proof, the L1 Zeko zkApp updates its _on-chain state_ to the new **ledger hash**, thereby finalizing and committing the batch of L2 transactions to the Layer 1 blockchain.

> [!TIP] 💡 Transaction Proofs and DA 💡
> The full transaction data for the batch is sent to the DA layer, while only the _constant-sized aggregated proof_ is sent to L1.

## Zeko Internal Design

Zeko is meant to be a **zkApp** that contains a _nested Mina ledger_ in its account state. Transfers of **Mina** and tokens between the _outer and inner ledgers_ should be possible. These are the only goals for the **MVP**.

The design is meant only to do this as well as possible. The MVP zkApp neither has any **data availability checks** to ensure that the witnesses necessary to operate on the zkApp are available in the network.

### Circuits

- **Outer circuit** (for L1 zkApp)
- **Inner circuit** (for handling transfers on the L2 side cleanly)
- **Transaction wrapper circuit** (for wrapping transaction snarks)
- **Action state extension circuit** (for proving one action state is an extension of another)
- **Helper token owner circuit** for recording transfers processed

### zkApp design

The L1 and L2 are connected by a _special account_ on the L2, denoted by having a **special public key**. The L1 account is called the **outer account**, and the L2 one the **inner account**.

The outer account keeps track of the **ledger hash** of the inner ledger, the hash of the _merkle list_ for all **withdrawals** (L2 -> L1). **Actions** on the outer account are treated as **deposits** (L1 -> L2).

The inner account keeps track, similarly, of all **deposits**.

Updating the ledger hash can be done via supplying a valid **ledger transition**, i.e. _transaction snark_.

The inner account must start with the _maximum amount of Mina possible_ when the rollup is made. When a **deposit** happens, an action is added to the outer account, along with **MINA**. On the inner side the recipient can _finalize the deposit_, taking the MINA from the L1 account.

For **withdrawals** (L2 -> L1), the same happens in reverse.

### Processing transfers

The central problem we face is that we can not send **MINA** trivially. MINA accounts may have `receive != None`, and we can not prevent them from _emptying their accounts_, meaning the sequencer's submitted transaction would fail, **DoSing the rollup**.

There are ways to solve this with `receipt_chain_hash`, but

1. They are _complicated_.
2. They can not work well when the `set_verification_key` permission is `Signature` or `Either`.

We opt to instead push this responsibility onto the **user**. The user can _finalize the transfer_ if they can prove it hasn't happened before. In a sense, we're delegating the responsibility of storing this state to the user, and must enforce they store it correctly. We can do it through **token accounts**, with a token owner that only allows storing _valid data_. We can do it by checking `receipt_chain_hash` at transfer-processing time. We can also use simpler indicators, such as `is_new`, after all, a new account can not have processed any transfers before!

### Token approach

A transfer has two stages:

1. **Submission** (add action)
2. **Processing** (move funds from Zeko account to user account)

During the processing, we must prove that we haven't processed the transfer already, by including a **helper account** specific to the recipient. The helper account tracks the **action state** at the time of the last transfer processing. The account update for the inner/outer account includes this as a _child_, and updates the action state to the current one. A proof that the actions between these two action states, filtered by recipient, total to the amount, must be included. If the account is new, the action state is regarded as being the _empty action state_.

In essence, we are tracking _per-recipient_ what transfers have been processed. We delegate the responsibility of this to the recipient themself. How do we prevent them from tampering with the data? We make the account have a **special token id**, which circuit only allows transactions in which they are _subordinate to the inner/outer account_.

Thus, they can never make an update which isn't also underneath the inner/outer account.

To simplify this, we make the inner/outer account the token owner, removing the need for tracking the public key of the token owner.

> [!TIP]
> If you are interested in reading more of internal design, please refer to the [white paper](https://docsend.com/view/f9a6kgdr4tjwuqng).
