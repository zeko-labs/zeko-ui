# Faucet CLI

Command-line client for the Zeko testnet faucet. Claim testnet tokens and verify your GitHub authentication from the terminal.

Written in Rust for fast startup and single-binary distribution. Distributed via npm with platform-specific packages.

The CLI is maintained in the private Zeko monorepo and mirrored to [zeko-labs/faucet-cli](https://github.com/zeko-labs/faucet-cli) for issues and releases.

## Installation

Install globally:

```bash
npm install -g @zeko-labs/faucet-cli
```

Or run without installing via `npx`:

```bash
GITHUB_TOKEN=ghp_xxx npx -y @zeko-labs/faucet-cli whoami
```

### Supported platforms

| Platform      | Package                              |
| ------------- | ------------------------------------ |
| macOS arm64   | `@zeko-labs/faucet-cli-darwin-arm64` |
| macOS x64     | `@zeko-labs/faucet-cli-darwin-x64`   |
| Linux x64     | `@zeko-labs/faucet-cli-linux-x64`    |
| Linux arm64   | `@zeko-labs/faucet-cli-linux-arm64`  |
| Windows x64   | `@zeko-labs/faucet-cli-win32-x64`    |
| Windows arm64 | `@zeko-labs/faucet-cli-win32-arm64`  |

The correct platform package is installed automatically via `optionalDependencies`.

## Authentication

Every command requires a **GitHub personal access token** (classic or fine-grained).
Each command accepts the token in this order:

1. `--token <value>` flag (highest priority)
2. `GITHUB_TOKEN` environment variable

```bash
# Using the flag
zeko-faucet whoami --token ghp_xxx

# Using the environment variable
export GITHUB_TOKEN=ghp_xxx
zeko-faucet whoami
```

## Commands

### `whoami`

Verify your GitHub token and display the associated account.

```bash
GITHUB_TOKEN=ghp_xxx zeko-faucet whoami
zeko-faucet whoami --token ghp_xxx
GITHUB_TOKEN=ghp_xxx zeko-faucet whoami --json
```

**Example output:**

```
Authenticated as octocat (#1).
Name: The Octocat
Profile: https://github.com/octocat
Created: 2011-01-25T18:44:36Z
Token source: env
```

### `claim <address>`

Submit a faucet claim for the given Mina address on the `zeko-testnet` chain.

```bash
GITHUB_TOKEN=ghp_xxx zeko-faucet claim B62qexample
zeko-faucet claim B62qexample --token ghp_xxx
GITHUB_TOKEN=ghp_xxx zeko-faucet claim B62qexample --json
```

**Example output:**

```
Claim submitted for B62qexample.
Chain: zeko-testnet
Amount: 100
Transaction: 5Jtxxx
Explorer: https://zekoscan.io/devnet/tx/5Jtxxx
```

## Command Options

Both `whoami` and `claim` support the same options:

| Flag      | Description                                             |
| --------- | ------------------------------------------------------- |
| `--token` | GitHub personal access token (overrides `GITHUB_TOKEN`) |
| `--json`  | Emit machine-readable JSON instead of human text        |

## Exit Codes

| Code | Meaning              |
| ---- | -------------------- |
| `0`  | Success              |
| `1`  | General error        |
| `2`  | Authentication error |
| `3`  | Rate limited         |
| `4`  | Invalid address      |

Scripts and CI pipelines can use exit codes to branch on specific failure types:

```bash
zeko-faucet claim B62qexample
case $? in
  0) echo "Claim succeeded" ;;
  2) echo "Bad token — check GITHUB_TOKEN" ;;
  3) echo "Rate limited — try again later" ;;
  4) echo "Invalid Mina address" ;;
  *) echo "Something went wrong" ;;
esac
```

## JSON Mode

Pass `--json` to any command for machine-readable output suitable for piping into `jq` or other tools.

**Success:**

```json
{
	"success": true,
	"address": "B62qexample",
	"chain": "zeko-testnet",
	"amount": "100",
	"hash": "5Jtxxx",
	"explorer_url": "https://zekoscan.io/devnet/tx/5Jtxxx"
}
```

**Error:**

```json
{
	"success": false,
	"code": "rate_limited",
	"message": "You have already claimed tokens recently."
}
```

## Development

Requires [Rust](https://rustup.rs/) and [pnpm](https://pnpm.io/).

```bash
# Build
moon run faucet-cli:build

# Run integration tests
moon run faucet-cli:test

# Lint
moon run faucet-cli:lint

# Check (fast compile check)
moon run faucet-cli:check
```
