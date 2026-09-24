# Zeko Core Concepts

Zeko is an Ethereum rollup with a zkApp execution layer. Its application model and recursive proof system derive from Mina; settlement and bridge custody live on Ethereum.

## The rollup mechanism

The sequencer applies transactions to the Zeko ledger and batches their state transitions. Recursive transaction proofs are merged into a proof of the batch. SP1 verifies the Zeko proof, and Ethereum settlement contracts verify the resulting proof and advance the accepted state.

L2 inclusion is available before this entire pipeline completes. Applications must distinguish an included transaction from an Ethereum-settled batch.

## The role of zero-knowledge proofs in Zeko

Pickles and Kimchi provide Zeko's inherited recursive proof foundations. Recursion lets a proof verify other proofs and compress validation of a sequence of state transitions. The Ethereum integration verifies this proof inside SP1 rather than requiring Ethereum to execute the Zeko ledger rules directly.

Applications can use proofs to keep private inputs off-chain. Proof-based execution alone does not make public account balances, transaction metadata, or bridge transfers private.

## zkApps and account updates

Zeko smart contracts are zkApps built with o1js. A `SmartContract` defines provable methods and on-chain state. A `ZkProgram` defines off-chain provable computations, including recursive programs whose proofs a contract can verify.

A zkApp transaction contains `AccountUpdate` values. Each describes account changes, preconditions, balance changes, and the authorization required by the account's permissions. Zeko accounts retain the `B62...` public-key format and token-account model.

## Actions and cross-layer state

Actions are append-only messages authenticated by an action-state commitment. The rollup's **outer** state faces settlement, and its **inner** state faces the L2 ledger.

Ethereum deposits become outer actions through the bridge proof. A later settlement synchronizes the deposit checkpoint into the inner state. Withdrawal requests become inner actions whose settlement-bound claim root lets the Ethereum bridge verify a withdrawal claim.

These names and encodings remain part of the protocol even though the outer state is now anchored by Ethereum contracts.

## Asset identity

ETH is the native asset on the Ethereum-backed deployment. Registered ERC-20 assets map to authenticated L2 token records. An L2 token ID is not an Ethereum contract address; applications must use the registry mapping and its decimal precision.

For the component boundaries and complete flow, see [Technical Architecture](./technical-architecture.md).
