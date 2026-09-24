# User Concepts Explained

## Two accounts, two networks

Ethereum uses `0x...` addresses. Zeko's L2 uses `B62...` addresses and the zkApp transaction model. MetaMask can hold the Ethereum account and, through the Zeko Snap, provide the Zeko account. The accounts are not interchangeable.

## ETH and tokens

ETH is the native asset of the Ethereum-backed Zeko deployment. Ethereum amounts use 18 decimals and Zeko native amounts use 9. Registered ERC-20 assets have an authenticated mapping to their L2 token; other custom Zeko tokens are not automatically bridgeable.

## Inclusion and finality

**L2 inclusion** means the sequencer applied a transaction. **Settlement** means the batch has been accepted by the Ethereum settlement contract. **Ethereum finality** means its block has reached the deployment's finalized chain view. A fast sequencer response does not collapse these steps into instant finality.

## Deposits and withdrawals

Deposits start on Ethereum and become usable on Zeko after bridge processing, synchronization, and L2 finalization. Withdrawals start with a Zeko request and require Ethereum settlement, a delay, and an Ethereum claim transaction.

## Fees

Ethereum deposits, approvals, and claims require Ethereum gas. Zeko transfers and zkApp operations require L2 fees. Use the fee displayed by the deployment; historical MINA fee examples do not describe the current ETH fee schedule.

## Proofs and privacy

Proofs verify valid execution without rerunning all application work on Ethereum. A proof can hide private inputs, but it does not automatically hide public balances or bridge transfers.

See the [security model](../architecture/security-model.md) for the experimental deployment's trust assumptions.
