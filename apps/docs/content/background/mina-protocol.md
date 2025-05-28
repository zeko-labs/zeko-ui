# Mina Protocol

_This section is a brief overview of the Mina Protocol, you can find more information in the [Mina documentation](https://docs.minaprotocol.com/)._

## Overview of Mina's Unique Architecture

Mina Protocol distinguishes itself with a unique architecture designed to be a **succinct blockchain**. At its core, Mina leverages zero-knowledge proofs (ZKPs), specifically using the **Kimchi proof system** and the **Pickles recursive system**. This allows for advanced cryptographic functions and efficient verification.

> [!TIP] 💡 Kimchi and Pickles 💡
> Find more about Kimchi and Pickles in this [Mina article](https://minaprotocol.com/blog/kimchi-the-latest-update-to-minas-proof-system) and in the [Mina Book](https://o1-labs.github.io/proof-systems/kimchi/overview.html).

A hallmark of Mina's design is its support for **arbitrary infinite recursive proof construction**. Mina is noted as being the only blockchain currently offering this capability. Recursion is fundamental to how Mina operates, being used to compress the historical blockchain data into a constant, small size. It also utilizes **tree-based recursive proofs** (described as "rollup-like") to compress transactions within blocks.

Developers on Mina build **zkApps**, which are zero-knowledge smart contracts. Interactions and state changes on Mina are expressed through **Account Updates**, the fundamental data structure for transactions. These updates contain instructions for the network and require specific authorization, which can be a signature or a proof derived from executing zkApp logic.

## How Zeko Leverages Mina

Zeko is a Layer 2 (L2) ecosystem purpose-built for Mina's zkApps.

It operates **on top of the Mina Layer 1 (L1)** chain, providing enhanced throughput and quicker transaction confirmation times while offering a **fully Mina-equivalent application layer**.

The Zeko rollup is implemented as a **zkApp account on the Mina L1 chain**, leveraging Mina's recursive capabilities and existing infrastructure. This design enables **seamless tooling integration** with existing Mina developer tools and wallets.

> [!TIP] 💡 Zeko's Architecture 💡
> For detailed information about Zeko's architecture, see the [dedicated Zeko section](../architecture/zeko-core-concepts.md).
