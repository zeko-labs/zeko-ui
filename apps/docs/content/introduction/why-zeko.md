# Why Zeko?

Zeko combines an application model built around zero-knowledge proofs with Ethereum settlement.

## Prove application logic off-chain

Developers write zkApps with [o1js](https://docs.o1labs.org/o1js/), a TypeScript library for zero-knowledge programs and smart contracts. Applications can prove a computation's result without publishing its private inputs. Privacy depends on the application's design: public balances, bridge transfers, and on-chain account updates are not automatically confidential.

## Aggregate verification

The sequencer batches L2 transactions, and recursive proofs establish the batch's validity. SP1 verifies the Zeko proof for Ethereum settlement. This separates application execution from the work Ethereum needs to verify an accepted state transition.

Fast L2 inclusion and Ethereum finality are different milestones. A transaction can appear in the Zeko explorer before its batch settles on Ethereum.

## Connect to Ethereum assets

The Ethereum bridge supports native ETH and registered ERC-20 assets. Users connect an Ethereum wallet for deposits and claims, and a Zeko wallet for L2 signatures. The Zeko Snap brings that L2 account into MetaMask where the deployment supports it.

## Build with the zkApp ecosystem

Zeko preserves its Mina-derived account and proof model, so o1js concepts such as `SmartContract`, `AccountUpdate`, and recursive `ZkProgram` proofs remain relevant. Developers can apply these tools to identity, verifiable computation, private application inputs, and programmable asset flows.

The current Ethereum deployment is experimental. Its permissioned operation and committee DA have explicit [security assumptions](../architecture/security-model.md); production blob DA is still under development.
