# Build On Zeko

Use this file when the user wants to build apps, zkApps, contracts, or lower-level integrations on Zeko.

## Start with Zeko docs

- Developer getting started: `https://docs.zeko.io/developers/getting-started`
- Custom network setup: `https://docs.zeko.io/developers/guides/custom-network`
- Bridge SDK docs: `https://docs.zeko.io/developers/guides/bridge-sdk`

## o1js path

- `o1js` is the default TypeScript path for most Zeko builders.
- Official docs: `https://docs.o1labs.org/o1js/`
- Constraint-system intro: `https://docs.o1labs.org/o1js/getting-started/what-is-a-zk-constraint-system`
- zkApps intro: `https://docs.o1labs.org/o1js/zkapps/intro`
- zkApp CLI: `https://github.com/o1-labs/zkapp-cli`
- o1js repo: `https://github.com/o1-labs/o1js`

## OCaml path

- Direct OCaml and protocol-native work is also valid on Zeko.
- Public protocol repo: `https://github.com/zeko-labs/zeko`
- Use this path when the user explicitly wants lower-level contracts, rollup internals, sequencer-adjacent logic, or protocol research instead of `o1js`.

## MCP note

- No canonical public o1js MCP page is listed in the current o1Labs docs.
- If the agent environment already exposes an o1js MCP server, use it as a convenience layer and keep the official o1js docs as the semantic source of truth.

## Practical routing

- Need endpoints or direct GraphQL inspection: read `references/40-endpoints-and-curl.md`.
- Need protocol roles like sequencer or DA layer: read `references/60-sequencer-archive-and-da.md`.
