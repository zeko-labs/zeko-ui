# Custom Network Configuration

Use the endpoint set supplied by the Ethereum-backed Zeko deployment. The legacy Mina-backed presets and their balances are separate networks.

## Connection information

| Setting | Purpose |
| --- | --- |
| Ethereum chain ID and RPC | Deposit, token approval, and withdrawal claim transactions. The testnet integration targets Sepolia. |
| Zeko sequencer GraphQL | L2 account reads and transaction submission. |
| Zeko archive GraphQL | Indexed L2 history. |
| Actions API | Indexed actions, witnesses, and registered asset mappings. |
| Gateway | Ethereum bridge status, settlement data, and public explorer APIs. |
| Explorer URLs | Links to the corresponding Zeko and Ethereum transactions. |

The bridge application reads public connection values from `/runtime-config.json`. Use its wallet connection flow to select the configured Zeko endpoint. Keep API keys and operator signing credentials out of browser configuration.

## Signing compatibility

The current Ethereum testnet configuration uses `minaSigningNetworkId: "testnet"` for Zeko signatures. The sequencer's circuit configuration must use the matching signing domain. This is an inherited cryptographic identifier; renaming it to `ethereum` or a display label invalidates signatures.

A Zeko address remains `B62...`. An Ethereum account is `0x...`. Switching the Ethereum chain in MetaMask does not by itself configure the Snap's Zeko GraphQL endpoint.

## Existing applications

Review network selection, native asset display, amount conversion, fees, and explorer links together. Do not replace `Mina` imports or provider method names merely to change branding: these APIs still construct and sign Zeko transactions.
