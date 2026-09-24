# Smart Contracts

A smart contract defines rules for authorized changes to blockchain state. Different execution models determine where the computation happens and how its result is verified.

## zkApps on Zeko

Zeko applications use zkApps written with [o1js](https://docs.o1labs.org/o1js/zkapps/intro). Developers define provable methods with `SmartContract` and express their effects as account updates. Clients can execute application logic and generate proofs off-chain; the network checks those proofs, preconditions, and authorizations before applying the updates.

A `ZkProgram` can express a separate provable computation, including recursion. A zkApp can verify its output and update state when the proof and required conditions hold.

## Ethereum settlement contracts

Zeko's Solidity contracts run on Ethereum. They verify settlement proofs, maintain accepted checkpoints, hold bridge custody, and release eligible withdrawal claims. This Ethereum integration does not change Zeko into an EVM execution environment.

## Public state and private inputs

A proof can establish a result without revealing private inputs. The account updates and data published by an application remain public. Developers must design what is hidden and what is disclosed; using a zkApp is not sufficient to guarantee transaction privacy.

Continue with [Developer Getting Started](../developers/getting-started.md) or [Zeko Core Concepts](../architecture/zeko-core-concepts.md).
