# Bridge CLI

Agent-first CLI for bridging assets between Mina and Zeko.

`zeko-bridge` is built for unattended agent use. The primary interface is the single high-level `bridge` command, which signs, submits, waits, retries transient network checks, advances queued claims in order, and streams progress until the requested bridge completes.

Lower-level commands still exist, but they are advanced tools for debugging, recovery, and explicit operator control.

The package is maintained in the private Zeko monorepo and mirrored to [zeko-labs/bridge-cli](https://github.com/zeko-labs/bridge-cli) for public source, issues, and releases.

## Status

Enabled routes:

- `mina:testnet -> zeko:testnet`
- `zeko:testnet -> mina:testnet`

Known but not yet enabled:

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

Or run it directly:

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

## Recommended Usage

### `bridge`

Use `bridge` by default. This is the command agents should reach for first.

```bash
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1
zeko-bridge bridge --from zeko:testnet --to mina:testnet --amount 3 --recipient B62q...
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1 --json
```

Flags:

| Flag              | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| `--from`          | Source chain reference. Defaults to `mina:testnet`.                                   |
| `--to`            | Destination chain reference. Defaults to `zeko:testnet`.                              |
| `--amount`        | Amount in Mina units.                                                                 |
| `--recipient`     | Optional destination account. Defaults to the account derived from the active signer. |
| `--timeout-slots` | Optional deposit timeout override for Mina-originated bridges.                        |
| `--json`          | Emit the final result as JSON on stdout. Progress continues on stderr.                |

Behavior:

- waits for completion by default
- retries transient bridge status and capability checks
- keeps printing useful progress during long waits without spamming every poll
- advances earlier queued claims in order when the account already has pending bridge work
- writes structured logs to disk for debugging and recovery

### JSON Result

`--json` prints a final object like:

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

## Advanced Commands

These commands are supported, but they are not the default agent path:

- `deposit` for low-level Mina-to-Zeko submit/finalize/cancel/status control
- `withdrawal` for low-level Zeko-to-Mina submit/finalize/status control
- `operation` for listing, inspecting logs, and resuming persisted operations
- `tui` for viewing active and recent operations in OpenTUI
- `doctor` for checking local paths, signer env status, and known routes

Use them when you need explicit low-level recovery or debugging. If you are simply trying to bridge, use `bridge`.

## Logs And State

The CLI writes:

- persisted operation state under the OS/XDG state directory
- append-only JSONL logs under the OS/XDG log directory

Use `operation logs <operation-id>` to inspect the recorded event stream for a specific bridge.

## Development

Run from the monorepo root:

```bash
moon run bridge-cli:build
moon run bridge-cli:typecheck
moon run bridge-cli:test
moon run bridge-cli:lint
```

Manual live validation instructions live in the internal `packages/bridge-cli/testing.md` document in the monorepo.

Release and mirror details live in the package-level release notes within the monorepo.

## Operator Setup Checklist

Before local live validation or scheduled monitoring can work, make sure all of the following are done:

1. Add funded testnet signer keys locally:
   `ZEKO_BRIDGE_MINA_PRIVATE_KEY`
   `ZEKO_BRIDGE_ZEKO_PRIVATE_KEY` if you do not want to reuse the Mina key
   Then run:
   `moon run bridge-cli:live-bridge-mina-to-zeko`
   or
   `moon run bridge-cli:live-bridge-zeko-to-mina`
2. Publish or confirm the npm version of `@zeko-labs/bridge-cli` that the validator should execute.
3. Create a Slack bot, grant it permission to post messages, and capture:
   `SLACK_BOT_TOKEN`
   `SLACK_CHANNEL_ID`
4. Create or configure the Inngest Cloud app and capture:
   `INNGEST_EVENT_KEY`
   `INNGEST_SIGNING_KEY`
5. Add the required env variables to the bridge-validator runtime.
6. Add the `INNGEST_EVENT_KEY` GitHub secret used by the scheduled dispatch workflow.
7. Confirm `.github/workflows/validate-bridge-cli-live.yaml` is enabled and the validator service is running before expecting Slack alerts.
