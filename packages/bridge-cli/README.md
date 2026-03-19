# Bridge CLI

CLI for bridging assets between Mina and Zeko.

`zeko-bridge` is built around a single high-level `bridge` command, which signs, submits, waits, retries transient network checks, advances queued claims in order, and streams progress until the requested bridge completes.

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

Required variables:

| Variable             | Required | Description                                                        |
| -------------------- | -------- | ------------------------------------------------------------------ |
| `WALLET_PRIVATE_KEY` | yes      | Shared wallet private key used for all currently supported routes. |

For human CLI usage, `zeko-bridge` auto-loads dotenv files in this order before falling back to inherited shell environment variables:

1. `~/.zeko/.env`
2. a sibling `.env` next to the CLI binary
3. a sibling `.env` next to the invocation path

Earlier files win over later files. If none of those files provide `WALLET_PRIVATE_KEY`, the CLI falls back to the existing exported environment variable.

## Recommended Usage

### `bridge`

Use `bridge` by default.

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
- is intended to complete unattended from a single CLI invocation, even when the network wait is very long
- validation of that unattended contract is only valid if the same original `bridge` process remains alive through completion; local persisted operation state alone is not proof that the live command is still running

### Current Protocol Notes

- Archive queries are most reliable when they scan recent history in roughly `10_000`-block windows instead of using a giant `from=0` range.
- After `submitDeposit`, long waits in `waiting-submission` are primarily an L1 visibility/finality concern. Mina-side progression can be slow, so a long pre-target wait does not by itself imply a stuck proof or sequencer bug.
- After a deposit has a target index, `canFinalizeDeposit` and `canCancelDeposit` still depend on the sequencer committing enough state to make the capability checks true. Long waits in `waiting-finalization` can therefore also be normal sequencer-side delay rather than a broken command loop.
- The `Invalid key` failure mode is not a general long-wait condition. It applies only after `finalizeDeposit` has been submitted and the server-side proof request then takes too long to complete. If that post-finalize proving step runs for roughly an hour or longer, the sequencer may evict the proof request from memory and later return `Invalid key`. That case is currently treated as a terminal failure and is not yet automatically recoverable.
- A cancellable deposit can never be finalized.
- Deposit queue behavior is asymmetric:
  - cancellable deposits are skippable
  - finalizable deposits must never be skipped
  - the protocol uses `lastFinalizedDeposit` on L2 and `lastCancelledDeposit` on L1, and only deposits with higher indices than those state values may be claimed
- The CLI does not fully implement cancellable-deposit skipping yet. The current behavior is documented here so operators understand the protocol rule and the current gap.

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

These commands are supported, but `bridge` is the default path for normal usage:

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

`operation status` now refreshes the persisted session with live SDK/network reads before printing it, and it emits a short stderr progress line first so the terminal does not look hung during that refresh. `operation list` still reads local persisted state only.

`operation status` is a recovery/debugging command, not a validation runner. It does not replace the original long-lived `bridge` process, it does not sign follow-up transactions on its own, and it must not be used as a polling loop to claim that a one-command bridge validation is still alive.

## Manual Validation

For funded real-network validation, run the built CLI directly so one long-lived `bridge` process owns the whole attempt:

```bash
export WALLET_PRIVATE_KEY='<wallet private key>'
node ./packages/bridge-cli/dist/cli.js bridge --from mina:testnet --to zeko:testnet --amount 1 --json --verbose
```

```bash
export WALLET_PRIVATE_KEY='<wallet private key>'
node ./packages/bridge-cli/dist/cli.js bridge --from zeko:testnet --to mina:testnet --amount 1 --json --verbose
```

Keep that same command alive through completion. Progress stays on stderr and the final JSON result stays on stdout.

## Development

Run from the monorepo root:

```bash
moon run bridge-cli:build
moon run bridge-cli:typecheck
moon run bridge-cli:test
moon run bridge-cli:lint
```
