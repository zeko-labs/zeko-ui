# What is Zeko?

Zeko is an Ethereum rollup for zero-knowledge applications. Developers build zkApps in TypeScript with o1js, execute application logic off-chain, and submit proofs and account updates to Zeko. Zeko batches transactions and settles the resulting state on Ethereum through SP1 proofs.

## Execution on Zeko, settlement on Ethereum

The Zeko sequencer orders transactions and applies them to the L2 ledger. Recursive proofs establish the validity of the resulting state changes. The Ethereum settlement integration verifies those proofs inside SP1, and Ethereum contracts verify the resulting proof and record the accepted state.

The bridge holds ETH and registered ERC-20 assets on Ethereum. Deposits are synchronized into Zeko, while withdrawals become claimable on Ethereum after settlement and the configured delay. See [the bridge guide](../users/guides/zeko-bridge.md).

## The application stack

Zeko retains the Mina-derived ledger, Pickles/Kimchi proof system, and o1js zkApp model. Those technical foundations support the Ethereum rollup; Mina is no longer its settlement chain. A Zeko L2 account still uses a `B62...` address, distinct from an Ethereum `0x...` address.

Ethereum settlement does not make Zeko an EVM execution environment. Solidity contracts handle settlement and custody on Ethereum; applications on Zeko use zkApps and o1js.

## Current stage

The Ethereum integration is experimental and targets Sepolia. Its current DA design uses a 2-of-3 committee. Ethereum blob publication and complete blob-to-batch-root binding remain future work. Read the [security model](../architecture/security-model.md) before using a deployment.

Start with the [user guide](../users/getting-started.md), [developer guide](../developers/getting-started.md), or [technical architecture](../architecture/technical-architecture.md).
