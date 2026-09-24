# Core Blockchain Concepts

## What is a blockchain?

A blockchain records transactions in a sequence of cryptographically linked blocks. Consensus rules determine which chain and state participants accept. Finality describes when an accepted block is no longer expected to be replaced under the protocol's assumptions.

Ethereum is the Layer 1 settlement chain for Zeko. Zeko executes transactions on Layer 2 and commits proof-backed state transitions to Ethereum.

## Wallets and keys

A wallet manages keys and asks you to approve signatures. Public addresses can be shared; private keys and recovery phrases must remain secret.

The Ethereum bridge uses an Ethereum `0x...` account and a Zeko `B62...` account. The Zeko Snap lets MetaMask provide Zeko signatures. These accounts serve different networks even when accessed through the same wallet application.

## Transactions and account updates

A transaction requests a state change, such as a payment or a smart-contract update. Zeko zkApp transactions contain `AccountUpdate` values describing changes, preconditions, balance movements, and required authorization.

The sequencer checks and applies valid transactions. Recursive proofs establish the batch's validity before Ethereum settlement. A transaction's L2 inclusion and its batch's Ethereum finality are distinct states.

See [User Concepts](../users/user-concepts-explained.md) for accounts, fees, and bridge progress.
