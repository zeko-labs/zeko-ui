# Bridge

Use this file for bridge UI questions, Bridge SDK setup, and deposit or withdrawal flow explanations.

## Public surfaces

- Bridge UI: `https://bridge.zeko.io`
- Bridge SDK package: `@zeko-labs/bridge-sdk`

## Prefer these sources

- Canonical SDK workflow: `packages/bridge-sdk/README.md`
- Canonical runtime endpoint mapping: `apps/bridge-ui/machines/helpers.ts`
- Example scripts: `packages/bridge-sdk/examples/*`

## SDK initialization

For programmatic usage, initialize `Bridge.init()` with:

- Zeko GraphQL endpoint
- Zeko archive GraphQL endpoint
- Mina node endpoint
- Mina archive endpoint
- Actions API endpoint
- Matching `l1Network` and `l2Network`

Use the HTTPS Actions API endpoint from the README and runtime helper. Do not copy the older `http://api.actions.zeko.io/graphql` example values.

## Bridge flow

- Deposit flow: submit deposit on Mina, wait for the bridge to synchronize the deposit witness, then finalize on Zeko.
- Withdrawal flow: submit withdrawal on Zeko, wait for the required bridge proof and delay, then finalize on Mina.
- Recovery flow: deposits can become cancelable if they are not finalized in time.

## Important operational nuance

- Bridge finalization time depends on witness size and proof work.
- For Mina devnet runtime traffic, prefer Zeko-owned proxy domains over raw Minascan devnet URLs.
- The bridge helper lists mainnet and alphanet URLs, but the live bridge app logic is effectively testnet-only unless newer runtime code proves otherwise.

## When answering users

- UI users: keep it high-level and point them to the public bridge site.
- Builders: provide the canonical endpoint set from `60-networks-and-endpoints.md`.
- Architecture questions about deposit witnesses, commit checkpoints, or holder accounts: use `70-architecture-and-protocol.md`.
