# Bridge SDK

Use this file for bridge automation and programmatic deposits or withdrawals.

## Default agent path

- Use `MINA_PRIVATE_KEY` for signing.
- Use the gateway-backed Mina endpoints from `references/50-endpoints.md`.
- Read `references/copied/bridge-sdk-readme.md` for exact `Bridge.init`, deposit, withdrawal, and finalize examples.

## Practical defaults

- Mina node: `https://gateway.mina.devnet.zeko.io`
- Mina archive: `https://gateway.mina.archive.devnet.zeko.io`
- Zeko node: `https://testnet.zeko.io/graphql`
- Zeko archive: `https://archive.testnet.zeko.io/graphql`
- Actions API: `https://api.actions.zeko.io/graphql`

## Notes

- Treat the gateway URLs as authoritative defaults.
- Use direct Minascan URLs only as backups.
