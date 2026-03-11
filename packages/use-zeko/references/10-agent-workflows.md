# Agent Workflows

Use this file first for practical agent behavior.

## Default path

- Prefer direct keys and environment variables.
- For signing Mina-side transactions, use `MINA_PRIVATE_KEY`.
- For faucet automation, use `GITHUB_TOKEN`.
- For CLI automation, prefer `--json`.

## Browser wallet exception

- Only use Auro Wallet when the agent is actively controlling a browser with extension access.
- If the agent is not driving a browser, do not default to wallet-extension flows.

## Fast routing

- Need exact bridge SDK method shapes: read `references/30-bridge-sdk.md` and `references/copied/bridge-sdk-readme.md`.
- Need exact faucet flags or JSON output: read `references/40-faucet-cli.md` and `references/copied/faucet-cli-readme.md`.
- Need endpoint values: read `references/50-endpoints.md`.
