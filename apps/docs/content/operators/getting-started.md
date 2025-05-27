# Getting Started

This section outlines the roles of different network operators, discusses required resources (to the extent available in the sources), and provides initial setup steps and tools.

## Overview of Operator Roles

Running a Zeko network involves operating several types of infrastructure components. Zeko is a Layer 2 (L2) ecosystem designed for Mina's zero-knowledge applications (zkApps). It functions as a ZK Rollup on top of Mina Layer 1 (L1).

The core operator roles described in the sources include:

- **Sequencer**: The sequencer is a vital component, acting as the "conductor" or "Transaction Powerhouse" of the Zeko network. Its primary responsibilities include:
  - **Transaction Collection and Application**: The sequencer accepts transactions from users, typically via a GraphQL API, and applies them to the current state of the Zeko ledger.
  - **Proof Verification and Generation**: It proves the validity of transactions using zero-knowledge proofs. The sequencer sends transactions to provers and also proves its own verification of aspects like preconditions, permissions, and authorizations, as well as the correct application of the transaction to the ledger. It aggregates proofs from multiple transactions into a single proof for a batch.
  - **Batch Processing**: The sequencer groups transactions into batches for more efficient processing and settlement on Layer 1.
  - **Data Posting**: It sends the transaction data to the Data Availability (DA) layer.
  - **Layer 1 Commitment**: Once a batch is ready and consensus is reached on the DA layer, the sequencer posts the aggregated proof to the ZK Rollup contract on Mina L1. This updates the L1 state and officially finalizes the batch and included bridge transfers.
  - **Bridge Management**: The sequencer handles L1->L2 deposit and L2->L1 withdrawal transfer requests by creating transfer requests for proving and facilitating the fetching of proved account updates.
  - Sequencers receive fees, paid in MINA. Decentralization of sequencers is being explored through an auction model.
- **Prover / Proof Generator**: These components are responsible for generating the necessary zero-knowledge proofs.
  - The sequencer dispatches transactions to provers.
  - The Zeko system model includes "Proof Generators" as actors, specifying roles like **Snark workers** (generating proofs for L2 transactions and blocks) and **Aggregators** (aggregating proofs).
  - Mina's underlying proof system, Kimchi, supports infinite recursive proof construction, leveraging the Pickles recursive system. Tree recursion, used internally in Mina, is supported robustly and is part of the sequencing mechanism for rollups.
- **Data Availability (DA) Layer Nodes**: This layer is a critical component for storing all transaction data that occurs on the rollup.
  - The DA layer consists of nodes that replicate the same storage.
  - DA layer validators (nodes) are responsible for storing historical data, publishing data availability proofs, and ensuring that required data is broadcast so the ledger state can be built by everyone, preventing the rollup from being stalled.
  - Validators on the DA layer sign the hashes of the batches.
  - Zeko currently uses a temporary DA layer implemented as a fork of the Ethermint (EVM) chain. The initial implementation uses a set of validators jointly managed by the project teams. Future development aims to decentralize the DA layer, allowing anyone to run and validate it.

## Hardware and Software Requirements

:::warning
WIP: This section is under construction.
:::

## Initial Setup and Configuration

:::warning
WIP: This section is under construction.
:::

Setting up Zeko network infrastructure involves building and running specific software components and potentially deploying smart contracts on both L1 and the DA layer.

- **Building and Running the Sequencer**:
  - The sequencer application can be built using the `dune build` command, often specifying a profile like `devnet`.
  - To run the sequencer, you execute the built binary (`run.exe`), providing necessary configuration options via command-line flags or environment variables. Essential environment variables include `DA_PROVIDER`, `DA_PRIVATE_KEY`, and `MINA_PRIVATE_KEY`. Command-line options cover details such as the GraphQL port (`-p`), REST server (`--rest-server`), sequencer zkApp public key (`--zkapp-pk`), maximum pool size (`--max-pool-size`), commitment period (`--commitment-period`), DA contract address (`--da-contract-address`), and database directory (`--db-dir`).
  - The sequencer can also be run using a provided Docker image.
- **Deploying the Rollup Contract**:
  - The ZK Rollup contract needs to be deployed on the Mina Layer 1 chain. This contract acts as the anchor on L1, storing the state root of the L2 ledger.
  - Deployment is performed using a script (`deploy.exe`) executed via `dune exec`. This requires specifying the `MINA_PRIVATE_KEY` (for the signer) and the `DUNE_PROFILE`, along with options for the REST server and test accounts path.
- **Setting up the DA Layer**:
  - The temporary DA layer implementation is based on a fork of `go-ethereum`. Setting it up involves cloning the `dcSpark/go-ethereum` repository, checking out the `release/1.10-mina` branch, and building the `geth` binary using `make geth`.
  - Deploying the necessary data availability contract involves starting the local `geth` instance (`npm run geth:start`) and running a Hardhat script (`npx hardhat run scripts/deploy.ts --network dev`).
- **Running the Archive Relay Adapter**:
  - To index the history of the Zeko rollup in a standard Mina archive node, the Zeko archive relay adapter can be used.
  - This adapter connects to the Zeko sequencer, subscribes to new changes (blocks), and relays them to a configured Mina archive node.
  - It is run using `dune exec ./archive_relay/run.exe`, requiring configuration specifying the Zeko sequencer URI (`--zeko-uri`), the archive node's host (`--archive-host`), and port (`--archive-port`). A `--bootstrap` flag can be used.
  - A Docker image is also available for the archive relay adapter.

### Useful Repositories and Tools

Several repositories and tools are relevant for Zeko network operators:

- [**Zeko Main Repository**](https://github.com/zeko-labs/zeko): The primary codebase for Zeko infrastructure components like the sequencer and prover.
- [**DA Layer Repository**](https://github.com/dcSpark/go-ethereum): The temporary data availability layer's implementation is based on the `dcSpark/go-ethereum` repository fork.
- [**Build System Tools**](https://dune.build/): `dune` is the build system used for compiling and running Zeko's OCaml-based components. `make` is used for building `geth` and Docker images.
- [**Mina/zkApp Tools**:](https://github.com/o1-labs/o1js) `o1js` is the programming library for zkApps on Mina and Zeko. While primarily a developer tool, understanding it is crucial for debugging and interacting with zkApp logic.
