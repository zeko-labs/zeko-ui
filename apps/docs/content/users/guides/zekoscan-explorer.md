# Using the Zeko Explorer

The Ethereum-backed Zeko explorer combines L2 transactions, Ethereum settlements, and bridge progress. Open it from the current bridge's explorer links so you inspect the same deployment as your wallet.

## Find a transaction or account

Search for a Zeko transaction hash, block, or `B62...` account. Transaction pages show the fee payer, nonce, memo, account updates, and archive inclusion status. Account pages show observed account state and recent transactions.

Use Ethereum transaction links for deposits, settlement submissions, and withdrawal claims. Those `0x...` transaction hashes belong to Ethereum and differ from Zeko transaction hashes.

## Follow settlement and bridging

- **Blocks and transactions** show L2 activity from the Zeko archive.
- **Settlements** show proof progress and accepted Ethereum state checkpoints.
- **Deposits** show finalized Ethereum deposits and synchronization progress.
- **Withdrawals** show inclusion, the withdrawal delay, claim availability, and indexed claims.
- **Next commit** reports the sequencer's current commit schedule when available.

L2 archive status and Ethereum finality are independent. A transaction visible in the archive is not proof that its batch has settled. Likewise, an Ethereum deposit receipt is not proof that its L2 finalization is complete.

## Legacy explorer links

Older ZekoScan links refer to Mina-backed Zeko networks. Use the explorer linked by the Ethereum deployment for ETH bridge activity; the legacy network's balances and transactions are separate.
