# Bridge CLI

Command-line tool for bridging assets between Mina and Zeko.

Use the `zeko-bridge` binary from the npm package. The package is distributed as a CLI, not as a library API for application imports.

## Supported Routes

Enabled routes:

| From           | To             | Direction  |
| -------------- | -------------- | ---------- |
| `mina:testnet` | `zeko:testnet` | Deposit    |
| `zeko:testnet` | `mina:testnet` | Withdrawal |

Known but not enabled yet:

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

Then run:

```bash
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1
```

Or run without a global install:

```bash
npx -y @zeko-labs/bridge-cli bridge --from mina:testnet --to zeko:testnet --amount 1
```

## Configuration

The currently enabled routes use one Mina-compatible private key:

| Variable           | Required | Description                                                                   |
| ------------------ | -------- | ----------------------------------------------------------------------------- |
| `MINA_PRIVATE_KEY` | Yes      | Private key used to sign supported Mina and Zeko testnet bridge transactions. |

You can export it in your shell:

```bash
export MINA_PRIVATE_KEY="<wallet private key>"
```

For local CLI use, `zeko-bridge` also loads dotenv files before reading inherited shell variables. The recommended file is:

```text
~/.zeko/.env
```

with:

```dotenv
MINA_PRIVATE_KEY=
```

If multiple dotenv files are found, the first value loaded wins. Existing shell variables are used only when no loaded dotenv file provides the same key.

## Full Bridge Flow

Use `bridge` for normal bridging. It submits the bridge transaction, waits for network state to become claimable, performs the required finalize or cancel action, persists progress, and prints the final result.

```bash
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1
zeko-bridge bridge --from zeko:testnet --to mina:testnet --amount 3 --recipient B62q...
zeko-bridge bridge --from mina:testnet --to zeko:testnet --amount 1 --json
```

Flags:

| Flag                 | Default           | Description                                                           |
| -------------------- | ----------------- | --------------------------------------------------------------------- |
| `--from`             | `mina:testnet`    | Source chain.                                                         |
| `--to`               | `zeko:testnet`    | Destination chain.                                                    |
| `--amount`           | Required          | Amount in MINA units.                                                 |
| `--account`          | Signer public key | Source account to use for bridge status and transaction requests.     |
| `--recipient`        | Source account    | Destination account.                                                  |
| `--timeout-slots`    | Route default     | Deposit timeout override for Mina-to-Zeko deposits.                   |
| `--poll-interval-ms` | `20000`           | Delay between bridge status polls while waiting.                      |
| `--retry-delay-ms`   | `5000`            | Delay before retrying transient network or bridge service errors.     |
| `--json`             | `false`           | Print the final result as JSON on stdout. Progress remains on stderr. |
| `--verbose`          | `false`           | Record and print SDK call diagnostics and wait reasons.               |

The command is designed to be left running until completion. Long waits can be normal while the source chain transaction becomes visible, while earlier queued bridge work is claimed, or while the destination chain becomes ready for finalization.

## Result JSON

With `--json`, `bridge`, `operation resume`, and `operation resume-all` print machine-readable results.

Example `bridge --json` result:

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
	"log_path": "/Users/example/Library/Logs/zeko-bridge/f3d3d12a-8a1c-4b8b-9a1e-2a6e6bc7a1d7.jsonl",
	"error": null
}
```

When `--verbose` is enabled, the JSON result can also include `verbose_diagnostics` with SDK call counts, timings, and capability wait reasons.

## Low-Level Commands

The low-level `deposit` and `withdrawal` commands expose individual bridge actions. They are useful for recovery, debugging, and operator workflows. For normal bridging, prefer `bridge`.

Common flags:

| Flag        | Description                                                                               |
| ----------- | ----------------------------------------------------------------------------------------- |
| `--from`    | Source chain. Defaults to the route's source testnet.                                     |
| `--to`      | Destination chain. Defaults to the route's destination testnet.                           |
| `--account` | Account to operate on. Defaults to the signer public key.                                 |
| `--json`    | Print JSON instead of formatted text.                                                     |
| `--verbose` | Enable verbose bridge diagnostics where supported.                                        |
| `--wait`    | Wait for submitted transactions to be included. Defaults to `true` for mutation commands. |

Deposit commands:

```bash
zeko-bridge deposit submit --amount 1
zeko-bridge deposit finalize
zeko-bridge deposit cancel
zeko-bridge deposit status
```

Deposit-specific flags:

| Command          | Extra flags                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `deposit submit` | `--amount`, `--timeout-slots`                                                     |
| `deposit status` | `--latest` to return only the latest deposit for the account. Defaults to `true`. |

Withdrawal commands:

```bash
zeko-bridge withdrawal submit --amount 1
zeko-bridge withdrawal finalize
zeko-bridge withdrawal status
```

Withdrawal-specific flags:

| Command             | Extra flags                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| `withdrawal submit` | `--amount`                                                                           |
| `withdrawal status` | `--latest` to return only the latest withdrawal for the account. Defaults to `true`. |

## Operation Commands

Bridge operations are persisted so they can be inspected or resumed after interruption.

```bash
zeko-bridge operation list
zeko-bridge operation completed
zeko-bridge operation status <operation-id>
zeko-bridge operation logs <operation-id>
zeko-bridge operation resume <operation-id>
zeko-bridge operation resume-all --from mina:testnet --to zeko:testnet
```

Commands:

| Command                 | Description                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `operation list`        | Prints all locally persisted operations as JSON.                                                                                                       |
| `operation completed`   | Lists completed and cancelled operations. Use `--json` for JSON output.                                                                                |
| `operation status <id>` | Refreshes one operation from current network state, saves the refreshed state, and prints status JSON. Use `--verbose` for verbose bridge diagnostics. |
| `operation logs <id>`   | Prints the JSONL event log for one operation.                                                                                                          |
| `operation resume <id>` | Continues a persisted operation. Supports `--json`, `--verbose`, `--poll-interval-ms`, and `--retry-delay-ms`.                                         |
| `operation resume-all`  | Discovers pending deposits and withdrawals for an account, matches them to persisted sessions when possible, and resumes them sequentially.            |

`operation resume-all` flags:

| Flag                 | Default           | Description                                           |
| -------------------- | ----------------- | ----------------------------------------------------- |
| `--from`             | `mina:testnet`    | Route source used for queue discovery.                |
| `--to`               | `zeko:testnet`    | Route destination used for queue discovery.           |
| `--account`          | Signer public key | Account whose pending bridge queue should be resumed. |
| `--poll-interval-ms` | `20000`           | Delay between status polls.                           |
| `--retry-delay-ms`   | `5000`            | Delay before retrying transient errors.               |
| `--json`             | `false`           | Print JSON output.                                    |
| `--verbose`          | `false`           | Enable verbose bridge diagnostics.                    |

`operation status` JSON includes stable operation fields plus live fields when they are available:

- `phase`, `status`, `route`, `direction`, `account`, `recipient`, `amount`
- `submitted_transactions`, `final_transaction`, `error`
- `target_index`, `claimable_index`, `pending_ahead`
- `can_finalize`, `can_cancel`, `next_action`, `waiting_on`
- `observed_counts` and `status_sources` for status endpoint visibility

## TUI And Doctor

Open the terminal UI:

```bash
zeko-bridge tui
zeko-bridge tui <operation-id>
```

The TUI shows active and completed operations, selected operation details, and recent log lines.

Check local configuration:

```bash
zeko-bridge doctor
```

`doctor` prints the data, state, log, and cache directories, signer configuration status, and known bridge routes.

## Logs And State

`zeko-bridge` stores operation state and logs in OS-standard application directories:

| Platform | State and logs                                                                     |
| -------- | ---------------------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/zeko-bridge/state` and `~/Library/Logs/zeko-bridge` |
| Linux    | `$XDG_STATE_HOME/zeko-bridge` or `~/.local/state/zeko-bridge`                      |
| Windows  | `%LOCALAPPDATA%\zeko-bridge\state` and `%LOCALAPPDATA%\zeko-bridge\logs`           |

Use `zeko-bridge doctor` to see the exact paths on your machine. Use `zeko-bridge operation logs <operation-id>` to inspect a specific operation log.

## Protocol Notes

- Mina-originated deposits can spend a long time waiting for source-chain visibility before a target index is observed.
- Deposit finalization and cancellation depend on bridge capability checks. A wait in `waiting-finalization` can mean the destination chain has not committed enough state yet.
- Earlier queued bridge work may need to be finalized or cancelled before the requested operation can complete.
- Cancellable deposits are skipped by cancellation; finalizable deposits are claimed in order.
- Withdrawals require the withdrawal to be committed before it can be finalized on the destination chain.
- If a post-finalize proof request runs for too long and the bridge service returns `Invalid key`, the command treats that response as terminal.
