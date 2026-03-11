# Bridge And Faucet

Use this file for programmatic bridge and funding workflows.

## Official docs

- Bridge SDK docs: `https://docs.zeko.io/developers/guides/bridge-sdk`
- Faucet CLI docs: `https://docs.zeko.io/developers/guides/faucet-cli`
- User bridge walkthrough: `https://docs.zeko.io/users/guides/using-zeko-bridge`

## Agent defaults

- Bridge SDK signing: `MINA_PRIVATE_KEY`
- Faucet CLI auth: `GITHUB_TOKEN`
- Faucet automation: prefer `--json`
- Faucet funding target: `zeko-testnet`
- Bridge endpoint values: use `references/40-endpoints-and-curl.md`

## Bridge SDK config defaults

- `l1Url`: `https://gateway.mina.devnet.zeko.io`
- `l1ArchiveUrl`: `https://gateway.mina.archive.devnet.zeko.io`
- `zekoUrl`: `https://testnet.zeko.io/graphql`
- `zekoArchiveUrl`: `https://archive.testnet.zeko.io/graphql`
- `actionsApi`: `https://api.actions.zeko.io/graphql`

## Faucet CLI commands

```bash
GITHUB_TOKEN=... zeko-faucet whoami --json
GITHUB_TOKEN=... zeko-faucet claim B62q... --json
```

## When to use what

- Use Bridge SDK docs when the user wants deposits, withdrawals, or finalization logic in code.
- Use Faucet CLI docs when the user wants testnet funds from a terminal or agent workflow.
- Use the user bridge guide when the user wants the browser flow instead of code.
