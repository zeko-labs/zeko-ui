# Mina Protocol

## Overview of Mina's Unique Architecture

Mina Protocol distinguishes itself with a unique architecture designed to be a **succinct blockchain**. At its core, Mina leverages zero-knowledge proofs (ZKPs), specifically using the **Kimchi proof system** and the **Pickles recursive system**. This allows for advanced cryptographic functions and efficient verification.

A hallmark of Mina's design is its support for **arbitrary infinite recursive proof construction**. Mina is noted as being the only blockchain currently offering this capability. Recursion is fundamental to how Mina operates, being used to compress the historical blockchain data into a constant, small size. It also utilizes **tree-based recursive proofs** (described as "rollup-like") to compress transactions within blocks.

Developers on Mina build **zkApps**, which are zero-knowledge smart contracts. Interactions and state changes on Mina are expressed through **Account Updates**, the fundamental data structure for transactions. These updates contain instructions for the network and require specific authorization, which can be a signature or a proof derived from executing zkApp logic. **Permissions** are used to define who has the authority to make changes to a smart contract's state or properties. Developers can also create and verify general zero knowledge programs, also known as circuits, within their zkApps using `ZkProgram()`.

## How Zeko Leverages Mina

Zeko is a Layer 2 (L2) ecosystem purpose-built for Mina's zkApps. It operates **on top of the Mina Layer 1 (L1)** chain, aiming to provide enhanced throughput and quicker transaction confirmation times. Zeko is designed to offer a **fully Mina-equivalent application layer**, allowing developers to leverage Mina's existing **security, tooling, and infrastructure**.

The Zeko rollup itself is implemented as a **zkApp account on the Mina L1 chain**. This L1 account, referred to as the "outer" account, tracks the **ledger hash** of the inner L2 ledger. By reusing a significant portion of Mina's transaction snark implementation and leveraging Mina's recursive capabilities, Zeko simplifies the development process for those familiar with Mina.

Communication and value transfers between the L1 (Mina) and L2 (Zeko) are facilitated by **posting actions** to the Zeko zkApp account on the L1 chain. Actions are Mina's method for handling concurrency in smart contracts. The Zeko sequencer processes L2 transactions in batches, generating a proof for each batch. This aggregated proof is then **committed to the Mina L1 chain** by updating the state of the Zeko zkApp account, effectively syncing the L2 state with the L1. The Zeko rollup node follows the L1 block height and relies on the L1 state for data availability and consistency.

Zeko's design, built on Mina, aims to provide benefits such as **seamless tooling integration** with existing Mina developer tools and wallets, **rapid onboarding** for Mina developers, and access to the **shared Mina community and resources**.
