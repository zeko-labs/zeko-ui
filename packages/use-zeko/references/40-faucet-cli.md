# Faucet CLI

Use this file for getting testnet funds from an agent context.

## Default agent path

- Set `GITHUB_TOKEN`.
- Use `--json` when another tool or agent will consume the output.
- Read `references/copied/faucet-cli-readme.md` for exact commands, flags, exit codes, and JSON examples.

## Fast commands

```bash
GITHUB_TOKEN=... zeko-faucet whoami --json
GITHUB_TOKEN=... zeko-faucet claim <address> --json
```

## Notes

- The faucet is for `zeko-testnet`.
- The public claim API is `https://api.faucet.zeko.io/claim`.
