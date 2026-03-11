# Endpoints

Use this file when you need exact public defaults for agent setup or `Bridge.init`.

## Primary defaults

- Zeko GraphQL: `https://testnet.zeko.io/graphql`
- Zeko archive: `https://archive.testnet.zeko.io/graphql`
- Mina gateway: `https://gateway.mina.devnet.zeko.io`
- Mina archive gateway: `https://gateway.mina.archive.devnet.zeko.io`
- Actions API: `https://api.actions.zeko.io/graphql`
- Faucet API: `https://api.faucet.zeko.io/claim`

## Backup Mina endpoints

- Mina node backup: `https://api.minascan.io/node/devnet/v1/graphql`
- Mina archive backup: `https://api.minascan.io/archive/devnet/v1/graphql`

## Rule

- Prefer the gateway endpoints first.
- Use Minascan as backup, not as the primary default.
- For Bridge SDK configuration, pass the gateway URLs by default.
