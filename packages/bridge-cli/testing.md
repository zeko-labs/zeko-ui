# Bridge CLI Testing

This file covers manual live validation only. Public usage documentation lives in [README.md](./README.md).

Agent-specific workflow rules live in [AGENTS.md](./AGENTS.md).

## Required Environment

The CLI auto-loads dotenv files in this order before falling back to exported shell variables:

- `~/.zeko/.env`
- a sibling `.env` next to the CLI binary
- a sibling `.env` next to the invocation path

Set this key in one of those locations or export it directly before running the manual live checks:

- `WALLET_PRIVATE_KEY`

Example shell setup:

```bash
export WALLET_PRIVATE_KEY="<wallet private key>"
```

## Manual Live Validation

Run from the monorepo root:

```bash
moon run bridge-cli:live-bridge-mina-to-zeko
moon run bridge-cli:live-bridge-zeko-to-mina
```

Those Moon tasks run the same real `bridge` command shown below with `--json --verbose`. They are convenience entrypoints, not alternate validation logic.

Exact one-command validation examples:

```bash
export WALLET_PRIVATE_KEY='<wallet private key>'
node ./packages/bridge-cli/dist/cli.js bridge --from mina:testnet --to zeko:testnet --amount 1 --json --verbose
```

```bash
export WALLET_PRIVATE_KEY='<wallet private key>'
node ./packages/bridge-cli/dist/cli.js bridge --from zeko:testnet --to mina:testnet --amount 1 --json --verbose
```

Each task:

- builds the local CLI
- runs that same single long-lived `bridge` command directly
- streams live progress on stderr while the bridge is waiting on the network
- leaves the final JSON result on stdout from that exact same command
- is expected to cover the unattended contract: start once, wait as long as needed, and eventually observe completion from that same CLI invocation

Hard validation rule:

- A live validation succeeds only if that same single `bridge` process stays alive through completion.
- Run exactly one command for the attempt: the high-level `bridge` command itself.
- Keep that command alive in one dedicated PTY/background terminal and monitor that same terminal's stdout/stderr. Do not replace it with a second polling command.
- If the `bridge` process exits, is interrupted, or the terminal/session is aborted, that validation attempt is invalidated immediately.
- Do not treat a stopped `bridge` process as an active validation.
- Persisted operation files are useful for debugging and manual recovery, but they do not prove that the original one-command validation is still running.
- `operation status` now performs fresh SDK/network reads and persists a refreshed live snapshot, so it is useful for inspecting actual bridge progress after an interruption.
- That still does not make an interrupted one-command validation successful. A saved status refresh is a recovery/debugging aid, not proof that the original validation process remained alive through completion.
- Do not start `operation status` loops, shell polling loops, or other sidecar monitors for the validation attempt. Those do not advance the bridge, do not sign follow-up transactions, and do not satisfy the one-command requirement.

These checks are manual entrypoints only. They are excluded from the normal Vitest suite and are not run by CI.

## Interpreting Progress

During long waits, expect stderr progress lines for:

- submission
- waiting for confirmation
- waiting on earlier queued claims
- retries after transient network/status errors
- periodic heartbeat summaries

If the account already has pending bridge work, the command may report that it is advancing an earlier claim before it can complete the current request. That is expected bridge behavior.

Operator notes:

- When checking archive-node action history manually, prefer recent `10_000`-block windows over a `from=0` full-history query.
- `bridge --json --verbose` is the preferred operator shape for live validation because it keeps the one real bridge process easy to watch: progress stays on stderr, and the final result stays on stdout.
- After `submitDeposit`, a bridge may sit in `waiting-submission` for a long time because Mina L1 visibility/finality is slow. That state alone does not mean the sequencer or proof flow is stuck.
- After a deposit gets a target index, `canFinalizeDeposit` and `canCancelDeposit` still wait on sequencer commit/progression. A long `waiting-finalization` period can therefore be expected even before any finalize transaction has been submitted.
- `Invalid key` is not expected just because a bridge spends a long time in pre-finalize waiting states. The relevant risk starts only after `finalizeDeposit` has been submitted and the server-side proof request then runs too long. If that post-finalize proving step stretches to roughly an hour or longer, the sequencer may evict the proof request from memory and later return `Invalid key`. That is currently terminal and should be recorded as such.
- For deposits, a cancellable entry can never also be finalized. Cancellable deposits are skippable in protocol terms, but finalizable deposits must never be skipped.

## Artifacts

On success, the CLI returns final JSON on stdout. Keep:

- `operation_id`
- `log_path`
- final transaction hash

Those are the minimum details needed to debug a long-running bridge or inspect it with `operation logs`.
