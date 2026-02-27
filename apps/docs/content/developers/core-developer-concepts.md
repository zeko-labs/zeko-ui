# Core Developer Concepts

:::warning
WIP: This section is under construction.
:::

## Dynamic Transaction Fees

When sending transactions on the Zeko network, you need to pay a fee.
While its possible to send a transaction and adjust the fee if it fails due to insufficient fee, it's recommended to calculate the fee beforehand to avoid unnecessary transaction failures.

To determine the fee, send a `query feePerWeightUnit(weight)` to the sequencer. This query allows you to calculate the required fee beforehand.

It would be ideal to call the query and send the fee with the variable surplus based on how critical it is to make the transaction.

<!-- - **o1js Deep Dive:**
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
  - Reading state. -->
