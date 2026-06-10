# Getting Started

Developers from all backgrounds are using **Zeko** to power their zkApps and reimagine what’s possible in the zkInternet era.

You already know [What is Zeko](../introduction/what-is-zeko.md) and [Why you should Build with Zeko](../introduction/why-zeko.md), so let’s get started launching your own zkApp or front-end on Zeko today.

**Zeko provides a fully Mina-equivalent application layer** for building and deploying zkApps, meaning you can use the same tools and libraries and your development environment setup for building zkApps on Zeko will largely follow the standard setup for Mina zkApp development.

## Step 1 – Intro and Education

> For developers new to Zeko, ZK, and Mina

If you are new to building on Mina or with zkApps, it is highly recommended to **start with the official [o1js documentation](https://docs.o1labs.org/o1js/)**. Zeko is an _isomorphic zkRollup on Mina_, so we reference the deep library of Mina resources wherever relevant.

> [!TIP] 💡 Developer Environment Setup 💡
>
> Follow the [o1js Getting Started guide](https://docs.o1labs.org/o1js/getting-started/what-is-a-zk-constraint-system) to set up your development environment for building zkApps.

Visit the [**Zeko GitHub repo**](https://github.com/zeko-labs/zeko/tree/compatible/src/app/zeko), the source code for the Zeko protocol, including the sequencer and data availability components.

### o1js Smart Contract Language Intro

**o1js** is a general-purpose zero-knowledge framework that gives you the tools to create zk proofs and write arbitrary zk programs (zkApps), leveraging a rich set of built-in provable operations. The o1js framework is packaged as a single TypeScript library that can be used in major web browsers and Node.js.

> [!TIP] 💡 o1js 💡
>
> Refer to [introduction to o1js](https://docs.o1labs.org/o1js/) and the [o1js GitHub repo](https://github.com/o1-labs/o1js).

### Advantages of Using Zeko

Zeko is different from Mina in several ways for developers and users:

- **Near-instant confirmation of transactions**
- **Dynamic parallel prover scaling** for higher throughput
- **Data-availability layer** for higher storage
- **Increased account updates** for greater app complexity
- **Framework for launching new zkRollups and AppChains**
- **Delegated zkApp and AppChain proving** _(future)_

### Power of zkApps

zkApps are zero-knowledge programs that are **Turing complete**, and offer enhanced privacy with client-side execution and private inputs, have off-chain computation and composability with **no gas fees**.

> [!TIP] 💡 zkApps 💡
> Refer to [zkApps Overview for new zk-Devs](https://docs.o1labs.org/o1js/zkapps/intro) and [zkApps for Ethereum Devs](https://docs.o1labs.org/o1js/zkapps/intro).

## Step 2 – Demo zkApps and UIs

> For Mina-native or ZK-adjacent devs

- [**Write and Deploy a zkApp Today**](https://docs.o1labs.org/o1js/zkapps/intro)
- Make sure to **[get a wallet & faucet tMINA](https://zeko.io/faucet) on Zeko** or **[Bridge tMINA](https://testnet.bridge.zeko.io) from Mina to Zeko**, and check your activity on **[ZekoScan testnet explorer](https://zekoscan.io/testnet/home)**. _(Auro wallet browser extension v2.4.1 or mobile app v2.2.0 or later are required)_
- Mina devnet [faucet](https://minascan.io/devnet/home) and [MinaScan](https://minascan.io/mainnet/home) explorer may also be helpful resources
- **Write your smart contract using the [zkApp CLI](https://github.com/o1-labs/zkapp-cli)**

### Taking zkApps to the Next Level

> Useful links and code examples

- **LuminaDex SDK for front-end swaps on Zeko and Mina**
  - The [SDK library](https://sdk.luminadex.com/) is designed to simplify the integration of the [LuminaDex contracts](https://github.com/Lumina-DEX/lumina/tree/main/packages/contracts) in a website.
  - [Beta Website](https://lumina-devnet.netlify.app/) using SDK and Lumina audited contracts. View the [Source Code on GitHub](https://github.com/Lumina-DEX/lumina/tree/main/packages/dex-ui).
- [Mina Fungible token standard](https://github.com/MinaFoundation/mina-fungible-token): example code for custom token implementations
- Other examples / demos:
  - [Prove you know the answer to a question (10 / 2 + 2 = ?)](https://github.com/RaidasGrisk/zkapp-ui)
  - [Off-chain voting Proof of Concept (POC)](https://github.com/Trivo25/offchain-voting-poc)
  - [Cryptographic Proof of NFT Endorsement](https://github.com/racampos/cpone)
  - [easy-mina-deploy](https://github.com/MinaPlayground/easy-mina-deploy) (deploy with one command by specifying your smart contract and keys)

## Step 3 – Accelerated Growth

> For experienced developers and teams

### Advanced Tools & Tutorials

Find out more about advanced tools and tutorials for zkApps development.

#### Intelligence Tools and AI

- [Mina Arbitrated Contracts](https://mac.sqrtxx.com/) (MAC) – a zkApp that creates zkApps
- [o1js MCP server](https://github.com/o1-labs/mcp-o1js/tree/main/packages/mcp-server-o1js#usage-with-claude-desktop) (search o1js docs, codebase, Mina Discord forums with Claude & Cursor)
- [zkApps AI Chatbot](https://zkappsumstad.com/) (GPT language model, extensively trained on Mina, zkApps, and o1js)

#### zkApp Developer In-Depth [Tutorials](https://docs.o1labs.org/o1js/tutorials/hmac/hmac-basics)

- [Deploy to a Network](https://docs.o1labs.org/o1js/zkapps/intro)
- [zkApp Browser UI](https://docs.o1labs.org/o1js/zkapps/intro)

#### Cross-chain signing and modular zkApp deployment using TEE

- [Silvana](https://login.silvana.dev/)
- [Silvana docs](https://docs.silvana.one/)

### Community

The Zeko community is mostly active on Discord :

- [**Zeko Discord**](https://discord.gg/edF9vzD7en)
- [**Mina Discord**](https://discord.com/invite/minaprotocol)

### Production zkApps

- [**ZekoTokens**](https://zekotokens.com/): Deploy tokens on Zeko
- **Solis, powered by LuminaDex:** _link TBD_
- **Obirium:** _link TBD_
