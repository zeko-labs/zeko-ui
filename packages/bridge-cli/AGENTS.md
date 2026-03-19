# Bridge CLI Agent Notes

Start with [README.md](./README.md) for user-facing CLI behavior. Use [testing.md](./testing.md) for manual live validation.

## Default Path

- Use `zeko-bridge bridge` by default.
- Treat `deposit`, `withdrawal`, `operation`, and `tui` as advanced/debug/recovery tools.

## Manual Validation

Run manual live validation from the monorepo root:

- `moon run bridge-cli:live-bridge-mina-to-zeko`
- `moon run bridge-cli:live-bridge-zeko-to-mina`

Those Moon tasks now run the real high-level `bridge` command directly with `--json --verbose`. They are not wrappers around extra polling logic.

Exact env setup lives in [testing.md](./testing.md). If a human wants you to run the bridge live from this machine, have them export the keys first, then run one direction at a time.

The CLI also auto-loads dotenv files for human usage. Prefer `~/.zeko/.env` first, then a sibling `.env` next to the CLI binary, then a sibling `.env` next to the invocation path.

These are manual only. Do not add them to automatic local workflows or CI.

## Parallel Subagents

If you split work across subagents:

- one subagent owns `mina:testnet -> zeko:testnet`
- one subagent owns `zeko:testnet -> mina:testnet`

For real network validation:

- prefer separate funded wallets per direction when you need isolation
- if subagents share a wallet, expect queued-claim ordering behavior and read the streamed progress carefully
- always capture `operation_id`, `log_path`, and final transaction hash from each run
- treat one-command validation strictly:
  - the validation is only valid while the original single `bridge` process is still alive
  - run exactly one long-lived `bridge` command in one PTY/background terminal and keep that same process alive until it completes or fails
  - monitor that same command's stderr/stdout directly; do not switch over to a separate `operation status` loop
  - if that process exits or is interrupted, the validation attempt is over and must not be reported as still running
  - `operation status` does fresh SDK/network reads and is useful for live recovery inspection, but it still does not retroactively make an interrupted one-command validation count as successful
  - a status loop does not advance the bridge, does not sign follow-up transactions, and does not count as validation
- read long deposit waits correctly:
  - `waiting-submission` after `submitDeposit` is usually Mina L1 visibility/finality delay
  - `waiting-finalization` before any finalize transaction exists can still be normal sequencer commit delay from `canFinalizeDeposit` / `canCancelDeposit`
  - do not infer proof-request eviction risk until after `finalizeDeposit` has actually been submitted

## Code Landmarks

- durable bridge flow: `src/commands/bridge.ts`
- phase model: `src/core/operation-machine.ts`
- reporter/log rendering: `src/core/reporter.ts`
- manual validation entrypoints: `moon.yml` and `tests/live-bridge.manual.test.ts`
