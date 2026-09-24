# Sending Tokens on Zeko

A Zeko transfer stays on L2. To move funds to an Ethereum address, use the [withdrawal flow](./zeko-bridge.md#withdraw-from-zeko-to-ethereum).

## Native ETH transfers

1. Open the wallet view supplied by the Ethereum bridge, or the Zeko Snap home page.
2. Check that the selected network is your Ethereum-backed Zeko deployment.
3. Enter the recipient's Zeko `B62...` address and the ETH amount.
4. Review the amount, fee, and recipient in the wallet confirmation, then sign.
5. Follow the transaction link in the [Zeko explorer](./zekoscan-explorer.md).

Your Ethereum `0x...` account and Zeko `B62...` account are different addresses. Native ETH on Zeko uses nine decimal places. Leave enough balance for the displayed fee and any account-creation cost.

## Token transfers

The bridge wallet view also supports standard MFT token transfers on Zeko. The application constructs and proves the token transaction, then asks the wallet to sign it. The first transfer can take longer while the token contract compiles.

Where the wallet lacks trusted decimal metadata, it displays and accepts exact token base units. Follow the displayed unit rather than assuming it matches an ERC-20's Ethereum decimals. Only registry-mapped tokens are eligible for the Ethereum bridge.

A transfer visible on L2 may still be awaiting Ethereum settlement. Check the relevant transaction and settlement views when finality matters.
