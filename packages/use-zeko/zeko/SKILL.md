---
name: zeko
description: Help an agent use Zeko through public docs, gateway-backed endpoints, Bridge SDK and Faucet CLI docs, and practical GraphQL queries for sequencer and archive workflows.
---

# Zeko

Use this skill when the user wants to use Zeko, inspect the network, bridge assets, get faucet funds, or build on Zeko.

Defaults:

- For agents, prefer private keys and environment variables over browser wallet flows.
- Only discuss Auro Wallet when the agent is actively driving a browser with extension access.
- Start with the smallest relevant reference file in this skill instead of a broad docs dump.
- Use the public docs pages behind `https://docs.zeko.io` through the targeted references below.
- Default to gateway-backed Mina testnet endpoints and direct Zeko GraphQL endpoints from `references/40-endpoints-and-curl.md`.
- Use the live node for current chain config and the archive node for historical actions and events.

Load only what you need:

- Docs map and routing: [references/10-navigation.md](references/10-navigation.md)
- Agent-first behavior: [references/10-agent-workflows.md](references/10-agent-workflows.md)
- User flows and browser-wallet exceptions: [references/20-user-flows.md](references/20-user-flows.md)
- Bridge CLI, Bridge SDK, and faucet workflows: [references/30-bridge-and-faucet.md](references/30-bridge-and-faucet.md)
- Endpoints and `curl` queries: [references/40-endpoints-and-curl.md](references/40-endpoints-and-curl.md)
- Building with `o1js` or OCaml: [references/50-build-on-zeko.md](references/50-build-on-zeko.md)
- Sequencer, archive node, and DA layer: [references/60-sequencer-archive-and-da.md](references/60-sequencer-archive-and-da.md)
