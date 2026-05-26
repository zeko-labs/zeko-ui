# Interacting with a Dapp

Zeko dapps use Mina-style wallet connections and zkApp transactions. The exact interface differs by application, but the safety checks are the same.

## Connect A Wallet

1. Open the dapp.
2. Select the Zeko network in your wallet.
3. Connect the wallet account you want the dapp to use.
4. Review the requested permissions before approving the connection.

If a dapp expects a different network, switch networks in the wallet before signing anything.

## Review Transactions

Before approving a transaction, check:

- the account that will sign
- the network name
- the requested action
- the fee
- any token amount or account update shown by the wallet

Reject the request if the wallet prompt does not match the action you intended to take.

## Confirm Results

After signing, wait for the dapp to show the transaction result. You can also check account and transaction activity in [Zekoscan](./zekoscan-explorer.md).

Some zkApp actions take longer than a simple token transfer because they depend on proving, sequencing, or bridge state. Avoid refreshing or submitting the same action repeatedly unless the dapp explicitly tells you the previous attempt failed.
