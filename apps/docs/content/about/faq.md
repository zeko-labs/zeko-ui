# Frequently Asked Questions

## What is Zeko?

Zeko is an Ethereum rollup for zkApps. Applications use TypeScript and o1js, while recursive Zeko proofs are verified through SP1 and settled by Ethereum contracts.

## Is Zeko still a Mina rollup?

The project's current direction is Ethereum settlement. The execution layer retains Mina-derived ledger, zkApp, address, and proof formats. Older Mina-backed deployments and their documentation remain separate legacy environments.

## Can I deploy Solidity contracts on Zeko?

Zeko applications use the zkApp model, not EVM bytecode. Solidity contracts implement settlement and custody on Ethereum. See [Developer Getting Started](../developers/getting-started.md).

## Which wallet do I need?

The Ethereum bridge uses an Ethereum `0x...` account and a Zeko `B62...` account. MetaMask handles Ethereum operations and the Zeko Snap provides L2 signing where supported. Local Snap development uses MetaMask Flask; the bridge also supports Auro as a compatible Zeko signer. Use the option enabled by your deployment.

## Why is my Zeko address different from my Ethereum address?

Zeko retains its existing public-key and account format. The Snap's `B62...` address belongs to L2; MetaMask's `0x...` address belongs to Ethereum. Use the destination address required by the bridge or transfer form.

## Do I need MINA?

The Ethereum-backed Zeko deployment uses ETH. MINA and tMINA in legacy network documentation refer to separate Mina-backed deployments. Old faucets do not fund ETH on the Ethereum rollup.

## Which assets can I bridge?

Native ETH and registered ERC-20 assets supported by the deployment. An arbitrary L2 custom token is not automatically bridgeable. Follow the asset selector and registry mapping in the [Ethereum bridge](../users/guides/zeko-bridge.md).

## Why is a deposit or withdrawal still pending?

Deposits require Ethereum finality, bridge processing, synchronization, and L2 finalization. Withdrawals require L2 inclusion, Ethereum settlement, the withdrawal delay, and a claim transaction. The [explorer](../users/guides/zekoscan-explorer.md) shows these stages separately.

## Are confirmations instant?

L2 inclusion can precede settlement. It is not Ethereum finality, and it does not immediately make a withdrawal claimable.

## Are all transactions private?

No. zkApps can prove statements about private inputs, but public account updates, balances, fees, and bridge activity remain observable. Privacy depends on application design.

## Is the Ethereum integration production-ready?

It is experimental and targets Sepolia. The current deployment model is permissioned and uses committee DA. Full Ethereum blob-to-batch-root binding remains future work. Read the [security model](../architecture/security-model.md) and the deployment's current release status.
