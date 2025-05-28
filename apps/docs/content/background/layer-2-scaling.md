# Layer 2 Scaling Solutions

_Blockchain technology, while revolutionary, faces challenges related to **scalability and throughput** on the base layer (Layer 1). As networks grow and usage increases, transaction speeds can slow down and fees can rise. This can limit the types of applications that can be practically built and used._

## The Need for Layer 2 Solutions

**Layer 2 (L2) scaling solutions** are designed to address these limitations by handling transactions off the main blockchain and submitting proofs or summaries back to Layer 1. Zeko is a Layer 2 (L2) ecosystem specifically designed for Mina's zero-knowledge applications (zkApps).It provides developers with a platform to build and deploy zkApps with **improved throughput and quick confirmation times**.

> [!TIP] 💡 Zeko vs Mina 💡
> Building on Zeko offers **enhanced scalability** (faster throughput than Layer 1 Mina) and **rapid finality** (instant confirmation compared to Mina). Zeko leverages the security and tooling of Mina while offering these performance benefits.

## Introduction to Rollups

Rollups are a category of Layer 2 scaling solutions. They operate by **bundling or "rolling up" many off-chain transactions** into a single transaction. This aggregated transaction is then verified and recorded on the main chain (Layer 1). This significantly reduces the amount of data that needs to be processed and stored on Layer 1, leading to faster and cheaper transactions.

There are different types of rollups, including Optimistic Rollups and Zero-Knowledge (ZK) Rollups. **Zeko is a ZK Rollup**. ZK-Rollups utilize **Zero-Knowledge Proofs (ZKPs)** to ensure that **all transactions within the bundled batch are valid. The process involves processing transactions off-chain.

A **sequencer** acts as a transaction collector, gathering these transactions and applying them to the current state. The sequencer efficiently groups transactions into **batches** and proves their validity using zero-knowledge proofs.

The transaction data itself is posted to a **Data Availability (DA) layer**. The sequencer then sends the aggregated proof of the batch to the Layer 1 via a smart contract. The ZK proof compresses the validation of the whole batch of transactions into the verification of a single zk-SNARK, which is of constant size.

> [!TIP] 💡 zk-SNARK 💡
> A zero knowledge proof. zk-SNARK is the acronym for zero knowledge succinct non-interactive argument of knowledge.

ZK-Rollups offer several key advantages:

- **Increased Throughput:** Batching transactions processed off-chain boosts overall transaction capacity.
- **Lower Gas Fees:** A single entity verifies the transactions, which is cheaper than verifying on every node in the network.
- **Privacy:** ZKPs can enhance privacy by proving validity without revealing transaction details.

> [!TIP] 💡 Zeko's Architecture 💡
> Zeko leverages Mina's recursive ZK technology, specifically the [Pickles](https://medium.com/minaprotocol/meet-pickles-snark-enabling-smart-contract-on-coda-protocol-7ede3b54c250) recursive system, as the foundation for its ZK Rollup. Zeko's modular architecture further allows for the creation of custom zkRollups, providing developers with flexibility in choosing components like the data availability solution.
