# Bridge CLI

Agent-first CLI for bridging assets between Mina and Zeko.

`zeko-bridge` is designed for unattended use by agents and automation. It wraps `@zeko-labs/bridge-sdk` with:

- one-command bridge flows
- lower-level submit/finalize/cancel/status commands
- resumable disk-backed operations
- structured log files for debugging
- machine-readable JSON output
- a terminal UI powered by OpenTUI

The package is maintained in the private Zeko monorepo and mirrored to [zeko-labs/bridge-cli](https://github.com/zeko-labs/bridge-cli) for public source, issues, and releases.

## Status

Current enabled routes:

- `mina:testnet -> zeko:testnet`
- `zeko:testnet -> mina:testnet`

Known but disabled routes are already modeled in the CLI:

- `mina:mainnet -> zeko:mainnet`
- `zeko:mainnet -> mina:mainnet`
- `eth:testnet -> zeko:testnet`
- `zeko:testnet -> eth:testnet`
- `eth:mainnet -> zeko:mainnet`
- `zeko:mainnet -> eth:mainnet`

## Installation

Install globally:

```bash
npm install -g @zeko-labs/bridge-cli
```

Or run it directly with `npx`:

```bash
npx -y @zeko-labs/bridge-cli bridge --from mina:testnet --to zeko:testnet --amount 1
```

The npm release is a single built JavaScript tarball. There are no platform-specific bridge-cli packages.

## Configuration

The CLI signs transactions from environment variables only in v1.

Create an env file from `packages/bridge-cli/.env.example`:

```bash
cp .env.example .env
```

Required variables:

| Variable                       | Required | Description                                                                                        |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `ZEKO_BRIDGE_MINA_PRIVATE_KEY` | yes      | Mina private key used for Mina-originated bridge actions.                                          |
| `ZEKO_BRIDGE_ZEKO_PRIVATE_KEY` | no       | Zeko private key used for Zeko-originated bridge actions. Falls back to the Mina key when omitted. |
| `ZEKO_BRIDGE_ETH_PRIVATE_KEY`  | no       | Reserved for future Ethereum routes.                                                               |

## Commands

### `bridge`

Run a full bridge flow from source to destination with automatic signing and submission.

```bash
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1
zeko-bridge bridge --from zeko:testnet --to mina:testnet --amount 3 --recipient B62q...
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1 --json
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1 --wait=false
```

Flags:

| Flag              | Description                                                                             |
| ----------------- | --------------------------------------------------------------------------------------- |
| `--from`          | Source chain reference. Defaults to `mina:testnet`.                                     |
| `--to`            | Destination chain reference. Defaults to `zeko:testnet`.                                |
| `--amount`        | Amount in Mina units.                                                                   |
| `--recipient`     | Optional recipient account. Defaults to the account derived from the active signer key. |
| `--wait`          | Wait for the full bridge lifecycle. Defaults to `true`.                                 |
| `--timeout-slots` | Optional deposit timeout override.                                                      |
| `--json`          | Emit the final result as JSON on stdout. Progress continues on stderr.                  |

When `--wait=false` is used, the CLI submits the first transaction, persists the operation, and exits. You can continue later with `operation resume`.

### `deposit`

Low-level deposit commands for `mina:testnet -> zeko:testnet`.

```bash
zeko-bridge deposit submit --amount 1
zeko-bridge deposit finalize --account B62q...
zeko-bridge deposit cancel --account B62q...
zeko-bridge deposit status --account B62q... --json
```

Subcommands:

- `submit`
- `finalize`
- `cancel`
- `status`

### `withdrawal`

Low-level withdrawal commands for `zeko:testnet -> mina:testnet`.

```bash
zeko-bridge withdrawal submit --amount 2
zeko-bridge withdrawal finalize --account B62q...
zeko-bridge withdrawal status --account B62q... --json
```

Subcommands:

- `submit`
- `finalize`
- `status`

### `operation`

Inspect or resume persisted bridge operations.

```bash
zeko-bridge operation list
zeko-bridge operation status <operation-id>
zeko-bridge operation logs <operation-id>
zeko-bridge operation resume <operation-id>
zeko-bridge operation resume <operation-id> --json
```

Subcommands:

- `list`
- `status`
- `logs`
- `resume`

Persisted operations include:

- route and direction
- amount and recipient
- current phase and status
- submitted transaction hashes
- final transaction metadata
- log path

### `tui`

Open the terminal UI for active and recent operations.

```bash
zeko-bridge tui
zeko-bridge tui <operation-id>
```

The TUI uses OpenTUI. The package ships a bundled Bun runtime dependency so end users do not need to install Bun separately.

### `doctor`

Inspect local paths and key configuration.

```bash
zeko-bridge doctor
```

## Output

Human mode writes progress updates to stderr and prints the final result to stdout.

JSON mode prints a final object like:

```json
{
	"success": true,
	"operation_id": "f3d3d12a-8a1c-4b8b-9a1e-2a6e6bc7a1d7",
	"route": "mina:testnet->zeko:testnet",
	"direction": "deposit",
	"status": "completed",
	"amount": "1",
	"recipient": "B62qexample",
	"submitted_transactions": [
		{ "action": "submit", "hash": "5Jsubmit" },
		{ "action": "finalize", "hash": "5Jfinalize" }
	],
	"final_transaction": {
		"action": "finalize",
		"hash": "5Jfinalize",
		"explorerUrl": "https://zekoscan.io/testnet/tx/5Jfinalize"
	},
	"explorer_urls": ["https://zekoscan.io/testnet/tx/5Jfinalize"],
	"log_path": "/Users/example/Library/Logs/zeko-bridge/f3d3d12a-8a1c-4b8b-9a1e-2a6e6bc7a1d7.jsonl"
}
```

## Logs And State

The CLI writes:

- persisted operation state under the OS/XDG state directory
- append-only JSONL logs under the OS/XDG log directory

Use `operation logs` to inspect the log stream for a specific operation.

## Development

Development happens from the monorepo root with `moon`:

```bash
moon run bridge-cli:build
moon run bridge-cli:typecheck
moon run bridge-cli:test
moon run bridge-cli:lint
```

Optional env-gated live validation tasks:

```bash
ZEKO_BRIDGE_ENABLE_INTEGRATION=1 moon run bridge-cli:integration-mina-to-zeko
ZEKO_BRIDGE_ENABLE_INTEGRATION=1 moon run bridge-cli:integration-zeko-to-mina
ZEKO_BRIDGE_ENABLE_INTEGRATION=1 ZEKO_BRIDGE_RESUME_OPERATION_ID=<id> moon run bridge-cli:integration-resume
```

Release and mirror details live in `packages/bridge-cli/RELEASE.md`.
