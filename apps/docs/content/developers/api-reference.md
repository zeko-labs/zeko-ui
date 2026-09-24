# API Reference

Zeko combines a zkApp execution API with Ethereum settlement and bridge APIs.

## Ethereum bridge and explorer

The Ethereum integration's [gateway reference](https://github.com/zeko-labs/ethereum-settlement/blob/main/docs/content/gateway/api.md) documents public deposit, withdrawal, and registry views. Its [explorer reference](https://github.com/zeko-labs/ethereum-settlement/blob/main/docs/content/explorer.md) documents L2 and settlement views. `@zeko-labs/eth-bridge-sdk` is the Ethereum bridge client; it composes the base Bridge SDK's Zeko transaction and witness logic with Ethereum custody operations.

The deployment's bridge configuration supplies the gateway, sequencer, archive, and Actions endpoints. Operator proof-approval routes and their credentials must remain server-side.

## Zeko execution APIs

- [o1js API reference](https://docs.o1labs.org/o1js/api-reference/Introduction): zkApps, proofs, account updates, and transaction construction.
- Sequencer GraphQL: live L2 state and transaction submission.
- Archive GraphQL: indexed L2 transaction history.
- Actions API: bridge actions, witnesses, and canonical asset mappings.

The Mina-derived API names and schemas remain compatibility interfaces. `Mina`, `sendZkapp`, and related identifiers in executable examples are not statements that Mina is the settlement chain.

## Existing package references

- [Base Bridge SDK](./tools/bridge-sdk.md): shared Zeko bridge primitives, with legacy Mina L1 examples clearly scoped.
- [Legacy Bridge CLI](./tools/bridge-cli.md): Mina-backed bridge operations.
- [Legacy Faucet CLI](./tools/faucet-cli.md): funding for the documented Mina-backed network.
- [Agent Skills](./tools/agent-skills.md): installable workflow guidance, with deployment assumptions to check before use.
