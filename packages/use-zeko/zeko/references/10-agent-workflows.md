# Agent Workflows

Use this file first for practical agent behavior.

## Default path

- Prefer direct keys and environment variables.
- Use `MINA_PRIVATE_KEY` for Mina-side signing.
- Use `GITHUB_TOKEN` for Faucet CLI authentication.
- Prefer CLI and HTTP flows that can be scripted and parsed.
- Reach for the public docs pages before guessing API shapes.

## Browser exception

- Only use Auro Wallet when the agent is controlling a browser with extension access.
- If the agent is not driving a browser, do not default to extension setup or wallet UI instructions.

## Operational defaults

- Start with `https://docs.zeko.io/llms-full.txt` for docs discovery.
- Use gateway-backed Mina testnet endpoints first.
- Use the live Zeko GraphQL endpoint for current config and the archive endpoint for history.
- Use `references/40-endpoints-and-curl.md` when you need something directly runnable.
