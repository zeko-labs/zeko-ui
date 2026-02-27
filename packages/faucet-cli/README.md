# @zeko-labs/faucet-cli

Command-line client for the public Zeko faucet API.

## Installation

```bash
pnpm add @zeko-labs/faucet-cli
```

You can also run it without installing:

```bash
npx @zeko-labs/faucet-cli whoami
```

## Authentication

Both commands use a GitHub personal access token. Pass it explicitly with `--token` or export
`GITHUB_TOKEN`. The CLI prefers `--token` when both are present.

## Commands

### `whoami`

Verifies the GitHub token against `GET https://api.github.com/user`.

```bash
zeko-faucet whoami
zeko-faucet whoami --token ghp_xxx
zeko-faucet whoami --json
```

### `claim <address>`

Submits a claim to `POST https://api.faucet.zeko.io/claim` using GitHub auth and the fixed
`zeko-testnet` chain.

```bash
zeko-faucet claim B62example
zeko-faucet claim B62example --token ghp_xxx
zeko-faucet claim B62example --json
```

## Exit Codes

- `0`: success
- `1`: general error
- `2`: authentication error
- `3`: rate limited
- `4`: invalid address
