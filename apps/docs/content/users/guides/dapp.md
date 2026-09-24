# Interacting with a zkApp

Zeko applications use the zkApp execution model. A website prepares account updates and may generate a proof of application logic before requesting a wallet signature.

1. Open the application's supported Zeko deployment and connect your Zeko wallet.
2. Confirm the selected network and `B62...` account. In MetaMask, Zeko operations are handled by the Zeko Snap; Ethereum operations use the Ethereum account.
3. Choose the application action and allow any client-side proof generation to finish.
4. Review the recipient, balance changes, and fee in the wallet before approving.
5. Follow the submitted transaction in the deployment's explorer.

Keep native ETH available on the Ethereum-backed Zeko network for fees. Connecting a wallet does not grant a website permission to spend funds without the applicable signature or account authorization.

A zkApp can use private inputs, but its public account updates, fees, and bridge activity remain visible. Read the application's own privacy model before providing sensitive information.

For funding, see [Using the Ethereum Bridge](./zeko-bridge.md). For transaction status, see [Using the Zeko Explorer](./zekoscan-explorer.md).
