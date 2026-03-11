# Networks and Endpoints

Use this file when the exact public endpoint values matter.

## Zeko GraphQL

| Network          | Endpoint                                   | Authority                                                         |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| testnet          | `https://testnet.zeko.io/graphql`          | `apps/bridge-ui/machines/helpers.ts`, `packages/graphql/moon.yml` |
| testnet archive  | `https://archive.testnet.zeko.io/graphql`  | `apps/bridge-ui/machines/helpers.ts`, `packages/graphql/moon.yml` |
| mainnet          | `https://mainnet.zeko.io/graphql`          | `apps/bridge-ui/machines/helpers.ts`                              |
| mainnet archive  | `https://archive.mainnet.zeko.io/graphql`  | `apps/bridge-ui/machines/helpers.ts`                              |
| alphanet         | `https://alphanet.zeko.io/graphql`         | `apps/bridge-ui/machines/helpers.ts`                              |
| alphanet archive | `https://archive.alphanet.zeko.io/graphql` | `apps/bridge-ui/machines/helpers.ts`                              |

## Mina GraphQL

| Use case                              | Endpoint                                             | Authority                                                                             |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Mina devnet runtime                   | `https://gateway.mina.devnet.zeko.io`                | `services/mina-proxy/wrangler.jsonc`, `services/mina-proxy/worker.ts`                 |
| Mina devnet archive runtime           | `https://gateway.mina.archive.devnet.zeko.io`        | `services/mina-archive-proxy/wrangler.jsonc`, `services/mina-archive-proxy/worker.ts` |
| Mina devnet schema generation         | `https://api.minascan.io/node/devnet/v1/graphql`     | `packages/graphql/moon.yml`                                                           |
| Mina devnet archive schema generation | `https://api.minascan.io/archive/devnet/v1/graphql`  | `packages/graphql/moon.yml`                                                           |
| Mina mainnet runtime                  | `https://api.minascan.io/node/mainnet/v1/graphql`    | `apps/bridge-ui/machines/helpers.ts`                                                  |
| Mina mainnet archive runtime          | `https://api.minascan.io/archive/mainnet/v1/graphql` | `apps/bridge-ui/machines/helpers.ts`                                                  |

## Other public APIs

| Surface          | Endpoint                              | Authority                                                                   |
| ---------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| Actions API      | `https://api.actions.zeko.io/graphql` | `services/actions/api/wrangler.jsonc`, `apps/bridge-ui/machines/helpers.ts` |
| Faucet claim API | `https://api.faucet.zeko.io/claim`    | `packages/faucet-cli/src/api.rs`                                            |

## Important nuances

- Runtime bridge traffic on Mina devnet prefers the Zeko-owned proxy domains, while schema tooling uses raw Minascan devnet endpoints.
- The bridge runtime helper maps both `mainnet` and `testnet` actions traffic to `https://api.actions.zeko.io/graphql`, and the file includes a TODO about mainnet configuration.
- Alphanet endpoints appear in the bridge helper only. Treat them as declared configuration, not proven live support.
- The bridge runtime code is effectively testnet-oriented even though more networks are listed in helper config.
