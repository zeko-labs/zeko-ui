# Build on Zeko

Use this file for app developers and zkApp builders.

## Default framing

- Zeko app development is `o1js`-first.
- Zeko is Mina-isomorphic enough that standard Mina zkApp patterns usually carry over.
- Use official o1js docs for framework semantics and the Zeko references here for Zeko-specific network, bridge, faucet, explorer, and protocol details.

## Recommended builder path

1. Start with the official o1js docs and zkApp introduction in `50-o1js-and-tooling.md`.
2. Set up a wallet and get testnet funds using `10-users.md`.
3. Use `60-networks-and-endpoints.md` for canonical Zeko and Mina GraphQL URLs.
4. Use `30-bridge.md` if the app needs L1/L2 deposits or withdrawals.
5. Use `40-faucet.md` if the app or workflow needs automated faucet claims or CLI integration.

## What Zeko-specific material adds

- Exact Zeko GraphQL and archive endpoints
- Mina proxy domains preferred by Zeko runtime traffic
- Bridge semantics and operation states
- Faucet UX, CLI, and auth expectations
- High-level rollup, sequencer, and DA concepts

## Best repo-backed builder sources

- `packages/bridge-sdk/README.md`
- `packages/bridge-sdk/examples/*` as secondary examples, not endpoint authority
- `packages/graphql/README.md`
- `apps/docs/content/developers/getting-started.md` as an outbound-link directory, not sole authority

## Caveats

- The developer getting-started page contains useful links, but also stale or placeholder entries. Treat it as a guidepost, not a canonical operational spec.
- For bridge endpoints, prefer the bridge runtime helper and Bridge SDK README over example scripts.
