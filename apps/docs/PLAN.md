# Historical Documentation Outline

> This is the archived outline for the earlier Mina-backed product. Current Ethereum rollup documentation lives in `content/`; do not use this outline as current onboarding or architecture guidance.

Welcome to the Zeko documentation! This guide provides information for everyone interested in Zeko, from new users and developers to network operators.

## 1. Introduction

- **1.1 What is Zeko?**
  - Elevator Pitch / High-level summary.
  - Briefly explain its purpose (e.g., zk-rollup on Mina).
- **1.2 Why Zeko?**
  - Key Benefits (Scalability, Security, Privacy features from ZK, leveraging Mina's properties).
  - Core Use Cases and potential applications.
- **1.3 Quick Start (For Users & Developers)**
  - The absolute fastest way to interact with Zeko (e.g., get testnet tokens, make a test transaction, deploy a simple contract from template).
  - Links to essential tools/resources needed immediately.
  - _Goal: Get users/devs hands-on within minutes._
- **1.4 Who is this Documentation For?**
  - Clearly define the target audiences (Users, Developers, Network Operators, Curious Minds).
  - Guide users to the relevant sections based on their role.

## 2. Background Concepts (Optional)

- _This section is for users new to blockchain or zero-knowledge concepts. Feel free to skip if you're already familiar._
- **2.1 Core Blockchain Concepts**
  - What is a blockchain?
  - Wallets & Keys (Public/Private)
  - Transactions
- **2.2 Smart Contracts & EVM (Optional, if relevant context for Zeko)**
  - What are smart contracts?
  - Brief mention of Ethereum/EVM if Zeko interfaces with or is analogous in certain ways.
- **2.3 Zero-Knowledge Proofs (ZKPs)**
  - High-level explanation: Proving something without revealing the information.
  - Why are they important for scalability/privacy?
- **2.4 Layer 2 Scaling Solutions**
  - The need for L2s.
  - Introduction to Rollups (Optimistic vs. ZK).
- **2.5 Mina Protocol**
  - Brief overview of Mina's unique architecture (succinct blockchain).
  - How Zeko leverages Mina.

## 3. Understanding Zeko (Core Architecture & Concepts)

- _This section dives deeper into how Zeko works under the hood._
- **3.1 Zeko Core Concepts**
  - How Zeko achieves scalability (Rollup mechanism).
  - The role of zero-knowledge proofs in Zeko.
  - zkPrograms (Zeko's smart contracts) - conceptual explanation.
  - State Management (How state transitions are handled).
- **3.2 Technical Architecture**
  - Zeko internal design
  - Detailed component breakdown (Sequencer, Prover, Verifier Smart Contract on Mina).
  - Data Availability layer (How Zeko data is anchored/available).
  - Transaction Lifecycle (Flow diagram: User Tx -> Sequencer -> Batching -> Proving -> Verification on Mina).
- **3.3 Security Model**
  - How Zeko inherits/provides security.
  - Trust assumptions (if any).
  - Formal Audits and security best practices for users/developers.
- **3.4 Roadmap**
  - Overview of past achievements and future plans.

## 4. Using Zeko (For End Users)

- _This section guides users on interacting with Zeko._
- **4.1 Getting Started**
  - Setting up a compatible wallet (e.g., Auro Wallet guide).
  - Obtaining Zeko tokens (Testnet Faucet, Mainnet information).
  - Connecting your wallet to Zeko (via dApp or web interface).
- **4.2 Guides and Tutorials**
  - Guide: Sending Zeko tokens.
  - Guide: Interacting with a dApp (general process).
  - Guide: Using the Zeko Bridge to transfer assets (e.g., between Mina and Zeko, or other connected chains).
  - Guide: Using the block explorer to view transactions, blocks, and addresses.
- **4.3 User Concepts Explained**
  - Testnet vs Mainnet (understanding the difference).
  - Understanding Transaction Fees.

## 5. Developing on Zeko (For Developers)

- _This section is for developers building on Zeko._
- **5.1 Getting Started**
  - Setting up your development environment (Node.js, etc.).
  - Installing Key Tools (o1js, Lumina SDK, Zeko CLI).
  - Essential Developer Links (GitHub Repos, Examples, Discord Dev Channel).
- **5.2 Core Developer Concepts**
  - **o1js Deep Dive:**
    - Introduction to o1js (Typescript framework for zkApps/zkPrograms).
    - Writing zk-circuits.
    - State management within zkPrograms.
    - Off-chain execution and proving.
  - **zkPrograms:**
    - Structure of a zkProgram.
    - Defining public and private inputs.
    - Writing verification logic.
  - **Lumina SDK:**
    - Introduction to Lumina SDK (Interacting with Zeko network).
    - Connecting to a Zeko node.
    - Sending transactions.
    - Reading state.
- **5.3 Guides & Tutorials**
  - Guide: Writing Your First "Hello World" zkProgram.
  - Guide: Compiling and Proving a zkProgram.
  - Guide: Deploying Your zkProgram to Zeko.
  - Guide: Interacting with Your Deployed zkProgram.
  - Guide: Building a Simple dApp Front-End for Zeko.
  - Guide: Integrating the Zeko Bridge into a dApp.
  - Guide: Handling State Updates and Proofs.
  - _[Placeholder for more specific task guides based on common use cases, e.g., Tokens, NFTs, DeFi primitives]_
- **5.4 Examples & Boilerplates**
  - Links to a curated list of example zkPrograms and dApps.
  - Simple project templates to kickstart development.
- **5.5 API Reference**
  - Reference documentation for the Lumina SDK.
  - Reference documentation for key parts of the o1js framework relevant to Zeko interaction.
- **5.6 Contributing to Zeko Development**
  - How to contribute to the Zeko protocol, tools, or documentation.

## 6. Running Network Infrastructure (For Operators)

- _This section is for individuals running Zeko nodes._
- **6.1 Getting Started**
  - Overview of Operator Roles (Sequencer, Prover).
  - Hardware and Software Requirements.
  - Initial Setup and Configuration.
  - Useful Repositories and Tools.
- **6.2 Guides**
  - Guide: Setting Up and Running a Sequencer Node.
  - Guide: Setting Up and Running a DAL.
- **6.3 Concepts for Operators**
  - Network Topology (How nodes connect and interact).
  - Role of the Verifier Contract on Mina.
  - Operator Economics (Staking, Rewards, Slashing - _If applicable in Zeko's design_).
- **6.4 Troubleshooting**
  - Common issues and their solutions.
  - Logging and debugging tips.

## 7. About

- **7.1 Glossary**
  - Centralized definitions for all Zeko, Mina and blockchain related terms.
- **7.2 Frequently Asked Questions (FAQ)**
  - Answers to common questions across all user types.
- **7.3 Community & Support**
  - Links to official Zeko community channels (Discord, Telegram, Forum).
  - How to get support.
  - How to report bugs or suggest features.
- **7.4 Changelog**
  - Chronological list of documentation updates and Zeko protocol changes reflected in the docs.
