# Faucet

Use this file for getting testnet tMINA, faucet website, faucet CLI, and faucet API questions.

## Public surfaces

- Faucet website: `https://faucet.zeko.io`
- Faucet claim API: `https://api.faucet.zeko.io/claim`
- Faucet CLI package: `@zeko-labs/faucet-cli`
- Chain target: `zeko-testnet`

## CLI basics

- Every command requires a GitHub personal access token.
- Token precedence is `--token` first, then `GITHUB_TOKEN`.
- Main commands:
  - `whoami`
  - `claim <address>`
- Both commands support `--json`.

## Machine-readable mode

- Prefer the CLI `--json` mode when the user is an agent or wants automation.
- `whoami --json` confirms GitHub auth.
- `claim <address> --json` returns chain, amount, transaction hash, and explorer URL on success.

## Exit-code semantics

- `0`: success
- `1`: general error
- `2`: authentication error
- `3`: rate limited
- `4`: invalid address

## What to prefer as authority

- CLI behavior and JSON shape: `packages/faucet-cli/README.md`
- Claim endpoint: `packages/faucet-cli/src/api.rs`
- Public worker domain: `apps/faucet/wrangler.jsonc`

## Important caveat

- `apps/faucet/README.md` is mostly maintainer and deployment context. Do not use it as the primary public faucet workflow reference.
- There is a naming inconsistency in repo code between `devnet.zeko.io/graphql` and `testnet.zeko.io/graphql`; prefer the endpoint mapping in `60-networks-and-endpoints.md` and verify when the exact live sequencer target matters.
