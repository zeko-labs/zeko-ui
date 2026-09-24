# Proof-System Heritage

Zeko's Ethereum rollup retains technical foundations developed in the Mina ecosystem: the ledger and account-update model, `B62...` addresses, zkApps built with o1js, and the Pickles/Kimchi proof system.

## Pickles and Kimchi

Kimchi supplies the underlying proof system, and Pickles supports recursive verification. Zeko uses these foundations to prove transaction state transitions and aggregate proofs. The Ethereum integration verifies the exported Pickles proof inside SP1 and settles its result through Ethereum contracts.

For technical details, see the [proof-systems book](https://o1-labs.github.io/proof-systems/) and [o1js documentation](https://docs.o1labs.org/o1js/).

## Compatibility is not settlement

Mina-derived API names, signing domains, schemas, and token formats remain meaningful implementation contracts. They should not be renamed as a cosmetic branding change. They do not mean that the Ethereum-backed Zeko deployment settles on Mina.

Earlier versions of Zeko did settle through a zkApp account on Mina L1. Those networks and their operational runbooks are retained as [legacy deployment documentation](../operators/guides-tutorials.md#legacy-mina-backed-deployments).

See [Technical Architecture](../architecture/technical-architecture.md) for the current Ethereum path.
