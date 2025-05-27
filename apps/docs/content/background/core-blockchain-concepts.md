# Core Blockchain Concepts

_This section provides a brief overview of fundamental blockchain concepts that are helpful to understand Zeko and zkApps. If you are already familiar with how blockchain technology works, you can skip this part._

## What is a blockchain?

At its core, a **blockchain is a special kind of database**. It functions as a **decentralised digital ledger** that securely records transaction data across a distributed network of computers. Data on a blockchain is organised into **blocks**, which are arranged chronologically and secured using **cryptography**. This structure ensures that the data is **transparent, secure, and immutable**. Once data is added to a block and that block is confirmed and added to the chain, it is virtually impossible to change it.

The decentralised structure means there is **no single central authority** controlling the flow of data or transactions; instead, a distributed network of computers works together to maintain the integrity of the network. This decentralisation makes large networks highly resistant to attacks. Consensus mechanisms are sets of rules that govern how nodes on the network agree on the state of the blockchain and the validity of transactions.

> [!TIP] 💡 Consensus 💡
> **Bitcoin** was the first cryptocurrency powered by blockchain technology and uses the **Proof of Work** consensus mechanism. In contrast, **Mina Protocol** is known for being a lightweight blockchain that uses a **Proof of Stake**-based consensus mechanism called **Ouroboros**. Find more about it in the [Mina Protocol documentation](https://docs.minaprotocol.com/mina-protocol/proof-of-stake).

## Wallets & Keys (Public/Private)

The security and verifiability of transactions on a blockchain rely heavily on cryptography. **Public-key cryptography**, also known as asymmetric cryptography, helps establish secure and verifiable transactions between users. This involves using pairs of keys: a **public key** (which can be shared) and a **private key** (which must be kept secret).

Digital signatures are used in blockchain cryptography, and verifying these signatures is part of the process nodes use to authenticate a transaction. Wallets are typically used to manage these keys and interact with the blockchain.

> [!TIP] 💡 Wallets 💡
> In the Mina and Zeko ecosystems, wallets such as [Auro wallet](https://www.aurowallet.com/) are used to manage your public and private keys. These keys are essential for signing transactions and interacting with zkApps using public-key cryptography. Refer to the Mina documentation for more information on [Mina wallets](https://docs.minaprotocol.com/using-mina/install-a-wallet).

## Blockchain Transactions

A transaction on a blockchain is essentially a record of interaction or value transfer between two parties. When a transaction is initiated, it is **broadcast to a network of nodes**. Each node validates the transaction based on predefined rules, verifying digital signatures and other data. Validated transactions are then grouped together into a block. On Mina and Zeko, the fundamental data structure that transactions are built from is called an **account update**.

::: details More on Account Updates
Each zkApp transaction constructed using o1js is composed of one or more `AccountUpdate` classes, which represent a set of instructions for the network, such as altering on-chain state or emitting an event. An `AccountUpdate` can include preconditions that must be met, apply updates to an account, and include assertions about its child account updates. Transactions can consist of multiple account updates, for example, one to subtract a fee and another to add a token balance.
:::
