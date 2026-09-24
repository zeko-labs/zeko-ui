# Getting Started

Build Zeko applications with TypeScript and o1js. The Ethereum rollup keeps the zkApp account and proof model while settling state and holding bridge custody on Ethereum.

## Learn the execution model

Start with the [o1js documentation](https://docs.o1labs.org/o1js/) for `SmartContract`, `AccountUpdate`, `ZkProgram`, and client-side proof generation. Mina examples remain useful for these APIs, but their network endpoints, asset names, fees, and L1 bridge assumptions do not describe the Ethereum-backed Zeko deployment.

Zeko is not an EVM execution environment. Solidity is used for Ethereum settlement and custody contracts; Zeko applications execute through zkApps.

## Select the deployment

Obtain the sequencer GraphQL, archive, Actions API, gateway, bridge, and explorer URLs from your deployment's configuration. Use a matching set of endpoints and contract identities. Do not substitute a legacy Mina-backed Zeko preset.

The current Ethereum integration targets Sepolia. Its bridge application loads public configuration from `/runtime-config.json`, including the Ethereum chain ID, endpoints, and Zeko signing domain. See [Custom Network Configuration](./guides/custom-network.md).

## Connect and fund a wallet

Use the deployment's Ethereum bridge to connect an Ethereum `0x...` account and a Zeko `B62...` account. The Zeko Snap in MetaMask handles L2 signatures where supported; Auro remains an alternative compatible signer. Local Snap development requires MetaMask Flask.

Bridge Sepolia ETH for L2 fees and keep Ethereum ETH for deposits and withdrawal claims. Use the displayed fee schedule rather than MINA amounts from older examples. Native ETH has 9 decimals on Zeko and 18 on Ethereum.

## Integrate the bridge

`@zeko-labs/eth-bridge-sdk` supplies the Ethereum gateway and custody integration. It reuses the base Bridge SDK for Zeko transactions, witnesses, and sequencer proof requests. ERC-20 assets require the deployment's canonical registry mapping.

The older `zeko-bridge` CLI and its Mina L1 bridge presets are legacy workflows. Changing their labels does not make them Ethereum bridge commands. See [API Reference](./api-reference.md) for the implementation boundaries.

## Verify the user flow

Test wallet authorization, fees and precision, L2 inclusion, and the relevant Ethereum settlement or claim status. Keep these statuses distinct in your application. The [explorer guide](../users/guides/zekoscan-explorer.md) explains what each view establishes.

Explore [examples and tooling](./examples-boilerplates.md) after checking each example's network assumptions. Read the [security model](../architecture/security-model.md) before integrating an experimental deployment.
