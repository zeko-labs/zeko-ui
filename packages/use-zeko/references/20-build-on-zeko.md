# Build on Zeko

Use this file when the user wants to build apps, zkApps, or protocol-facing integrations on Zeko.

## Main paths

- `o1js` is the default TypeScript path for most app builders.
- OCaml is also valid for lower-level or protocol-native contract work.

## o1js path

- Docs: `https://docs.o1labs.org/o1js/`
- Getting started: `https://docs.o1labs.org/o1js/getting-started/what-is-a-zk-constraint-system`
- zkApps intro: `https://docs.o1labs.org/o1js/zkapps/intro`
- zkApp CLI: `https://github.com/o1-labs/zkapp-cli`

## OCaml path

- Public Zeko protocol repo: `https://github.com/zeko-labs/zeko`
- Use this when the user explicitly wants direct OCaml contracts, protocol code, or lower-level integration instead of `o1js`.

## Practical advice

- Use `references/50-endpoints.md` for live defaults.
- Use `references/30-bridge-sdk.md` if the app needs Mina/Zeko bridging.
- Use `references/40-faucet-cli.md` if the app needs automated testnet funding.
