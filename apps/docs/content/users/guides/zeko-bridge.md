# Using the Ethereum Bridge

The Ethereum ↔ Zeko bridge moves native ETH and registered ERC-20 assets between Ethereum custody and Zeko execution. Open the bridge provided for your deployment and verify the Ethereum network, connected accounts, and asset before proceeding.

## Before you start

- Connect an Ethereum `0x...` account for deposits and claims.
- Connect a Zeko `B62...` account with the Zeko Snap in MetaMask, or the deployment's supported Auro option.
- Keep ETH for Ethereum gas and Zeko transaction fees.
- Use only assets listed by the bridge's registry. A token symbol alone does not establish its identity.

The current Ethereum integration is experimental. Deposits have no cancellation or refund flow. Read the [security model](../../architecture/security-model.md).

## Deposit from Ethereum to Zeko

1. Select **Deposit**, choose ETH or a registered ERC-20, and enter an amount.
2. Check the destination Zeko address and fee information.
3. For ERC-20s, approve the token allowance when requested, then sign the deposit transaction. For ETH, sign the deposit directly in the Ethereum wallet.
4. Wait for Ethereum finality and bridge processing. The gateway processes finalized deposit logs, and a later Zeko settlement synchronizes the deposit into L2.
5. Follow the bridge's remaining finalization step and wait for the Zeko balance to update.

An Ethereum deposit receipt is the start of this process. It does not by itself mean the funds are spendable on Zeko.

## Withdraw from Zeko to Ethereum

1. Select **Withdraw**, choose the asset, and enter the amount and Ethereum recipient.
2. Review and sign the withdrawal request with your Zeko wallet.
3. Wait for the request to be included in Zeko, settled on Ethereum, and past the configured withdrawal delay.
4. When **Claim** becomes available, submit the claim from your Ethereum wallet and pay Ethereum gas.
5. Check the Ethereum receipt and destination balance.

The settlement prover binds the withdrawal to an accepted root. The claim uses a Merkle inclusion proof supplied by the gateway; the user does not generate an SP1 proof.

## Amounts and progress

Ethereum ETH uses 18 decimals; native ETH on Zeko uses 9. The bridge constrains amounts to the supported Zeko precision and performs the conversion. ERC-20 precision follows the registered asset mapping. Do not reinterpret Zeko base units as Ethereum wei.

The activity view recovers deposits and pending withdrawals after a reload. Keep transaction hashes for support. L2 inclusion, Ethereum settlement, and a completed claim are separate milestones; use the status shown for the step you are waiting on.

## Legacy Mina bridge

The older Mina ↔ Zeko bridge and Bridge CLI operate against Mina-backed deployments. Their MINA operations cannot be used as ETH bridge operations by changing a label or network URL. See the [legacy CLI reference](../../developers/tools/bridge-cli.md) only when using that deployment.
