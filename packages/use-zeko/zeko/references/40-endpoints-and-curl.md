# Endpoints And Curl

Use this file when you need exact public endpoints, Bridge SDK config values, or directly runnable queries.

## Common agent use

- If the user asks which endpoints to pass to the Zeko Bridge SDK or `Bridge.init`, start here.
- If the user asks for a query they can run right now with `curl`, start here.

## Testnet defaults

- Zeko GraphQL: `https://testnet.zeko.io/graphql`
- Zeko archive: `https://archive.testnet.zeko.io/graphql`
- Mina gateway: `https://gateway.mina.devnet.zeko.io`
- Mina archive gateway: `https://gateway.mina.archive.devnet.zeko.io`
- Actions API: `https://api.actions.zeko.io/graphql`
- Faucet claim API: `https://api.faucet.zeko.io/claim`
- Bridge UI: `https://bridge.zeko.io`
- Faucet UI: `https://faucet.zeko.io`
- Explorer: `https://zekoscan.io/testnet`

## Non-testnet note

- This skill defaults to public testnet values because those are the stable public builder defaults.
- If the user needs a browser wallet or custom network config for another network, start with `https://docs.zeko.io/developers/guides/custom-network`.

## Mina fallback endpoints

- Mina node backup: `https://api.minascan.io/node/devnet/v1/graphql`
- Mina archive backup: `https://api.minascan.io/archive/devnet/v1/graphql`

Rule:

- Treat the gateway Mina endpoints as the default read path.
- Use Minascan as a backup, not the first choice.

## Curl: inspect the sequencer public key

```bash
curl -sS https://testnet.zeko.io/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query SequencerPK { sequencerPk }"}'
```

## Curl: inspect live bridge and circuit config

```bash
curl -sS https://testnet.zeko.io/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query FetchConfig { circuitsConfig { zekoL1 zekoL2 holderAccountsL1 holderAccountL2 chainL1 chainL2 withdrawalDelay } }"}'
```

## Curl: inspect Mina runtime config through the gateway

```bash
curl -sS https://gateway.mina.devnet.zeko.io \
  -H 'content-type: application/json' \
  --data '{"query":"query RuntimeConfig { runtimeConfig }"}'
```

## Curl: inspect a Mina account through the gateway

```bash
curl -sS https://gateway.mina.devnet.zeko.io \
  -H 'content-type: application/json' \
  --data '{"query":"query Account($pk: PublicKey!) { account(publicKey: $pk) { zkappState } }","variables":{"pk":"B62q..."}}'
```

## Curl: inspect archive height before historical queries

```bash
curl -sS https://gateway.mina.archive.devnet.zeko.io \
  -H 'content-type: application/json' \
  --data '{"query":"query NetworkState { networkState { maxBlockHeight { canonicalMaxBlockHeight pendingMaxBlockHeight } } }"}'
```

## Curl: inspect historical Mina actions from the archive node

```bash
curl -sS https://gateway.mina.archive.devnet.zeko.io \
  -H 'content-type: application/json' \
  --data '{"query":"query FetchActions($pk: String!) { actions(input: { address: $pk, from: 0, to: 1 }) { blockInfo { height timestamp } actionData { transactionInfo { hash } data } } }","variables":{"pk":"B62q..."}}'
```

## Curl: inspect Zeko archive event filter fields before running an event query

```bash
curl -sS https://archive.testnet.zeko.io/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query EventFilterShape { __type(name: \"EventFilterOptionsInput\") { inputFields { name } } }"}'
```

## Practical rule

- Use the live Zeko endpoint for `sequencerPk`, `circuitsConfig`, and live request status.
- Use archive nodes when you need historical actions, events, or backfill-style debugging.
