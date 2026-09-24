# Getting Started

Use the bridge and explorer supplied for the Ethereum-backed Zeko deployment. The current integration targets Ethereum Sepolia; use test assets and confirm the network shown by the application before connecting.

## Connect your wallets

The Ethereum bridge uses two accounts:

| Account | Address | Used for |
| --- | --- | --- |
| Ethereum | `0x...` | Depositing ETH or ERC-20s, approving tokens, and claiming withdrawals. |
| Zeko L2 | `B62...` | Receiving bridged assets and signing Zeko transfers or withdrawal requests. |

1. Open the deployment's Ethereum bridge and connect an Ethereum wallet on the network it requests.
2. Choose **MetaMask** with the **Zeko Snap** for your Zeko account. Review the Snap installation or connection request and approve access to the selected Zeko network.
3. Confirm both the Ethereum address and the Zeko address shown in the bridge.

The Snap's availability in ordinary MetaMask depends on its release and allowlisting status. Local Snap development uses MetaMask Flask. Use the wallet option supported by your deployment; the bridge also supports Auro as a compatible Zeko signer. Auro's existing Mina network presets do not select the Ethereum-backed Zeko deployment automatically.

Keep your wallet recovery phrase private and backed up. The bridge never needs it.

## Fund the account

Obtain Sepolia ETH for Ethereum transactions, then use the bridge's **Deposit** flow to move ETH to your Zeko account. Registered ERC-20 assets appear in the bridge's asset selector when the deployment publishes its registry. Keep ETH available for fees on both sides.

A deposit progresses through Ethereum finality, bridge processing, synchronization with Zeko, and L2 finalization. Follow the application's progress until the funds are available. See [Using the Ethereum Bridge](./guides/zeko-bridge.md).

## Use Zeko

Use the Zeko account for [L2 transfers](./guides/sending-tokens.md) and [zkApps](./guides/dapp.md). Open transaction and settlement details in the [Zeko explorer](./guides/zekoscan-explorer.md).

## Existing Mina-backed deployments

Older Zeko faucets, Mina bridge links, and wallet presets serve separate Mina-backed networks. Their MINA balances are not ETH on the Ethereum rollup. Do not reuse an old endpoint as an Ethereum endpoint; use the configuration supplied by the current deployment.
