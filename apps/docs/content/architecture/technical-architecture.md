# Technical Architecture

:::warning
WIP: This section is under construction. Content is for illustrative purposes only.
:::

Zeko consists of a Sequencer, Prover, and a Verifier smart contract on Mina. Data availability is ensured by anchoring proofs to Mina.

```d2
UserTx -> Sequencer: Collects & Batches
Sequencer -> Prover: Sends batch
Prover -> Mina: Submits proof
Mina -> Verifier: Verifies proof
```
