# Agent Workflows

Use this file first for practical agent behavior.

## Default path

- Prefer direct keys and environment variables.
- Prefer the Bridge CLI for unattended bridge execution from an agent.
- Use `MINA_PRIVATE_KEY` for Mina-side signing.
- Use `WALLET_PRIVATE_KEY` for Bridge CLI signing.
- Use `GITHUB_TOKEN` for Faucet CLI authentication.
- Prefer CLI and HTTP flows that can be scripted and parsed.
- Reach for the public docs pages before guessing API shapes.

## Browser exception

- Only use Auro Wallet when the agent is controlling a browser with extension access.
- If the agent is not driving a browser, do not default to extension setup or wallet UI instructions.

## Operational defaults

- Start with the smallest matching public docs page, not `llms-full.txt`.
- For unattended bridging, start with `https://docs.zeko.io/developers/tools/bridge-cli`.
- Use gateway-backed Mina testnet endpoints first.
- Use the live Zeko GraphQL endpoint for current config and the archive endpoint for history.
- Use `references/40-endpoints-and-curl.md` when you need something directly runnable.
- Only use `https://docs.zeko.io/llms-full.txt` after the targeted docs pages and in-skill references are still insufficient.
