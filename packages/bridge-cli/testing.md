# Bridge CLI Testing

This file covers manual live validation only. Public usage documentation lives in [README.md](./README.md).

## Required Environment

Set these before running the manual live checks:

- `ZEKO_BRIDGE_WALLET_PRIVATE_KEY`

Example shell setup:

```bash
export ZEKO_BRIDGE_WALLET_PRIVATE_KEY="<wallet private key>"
```

If you want me to run the live bridge validation from this machine, set the variables exactly like that in the shell first, then tell me which direction to run.

## Manual Live Validation

Run from the monorepo root:

```bash
moon run bridge-cli:live-bridge-mina-to-zeko
moon run bridge-cli:live-bridge-zeko-to-mina
```

Exact one-shot command examples:

```bash
export ZEKO_BRIDGE_WALLET_PRIVATE_KEY='<wallet private key>'
moon run bridge-cli:live-bridge-mina-to-zeko
```

```bash
export ZEKO_BRIDGE_WALLET_PRIVATE_KEY='<wallet private key>'
moon run bridge-cli:live-bridge-zeko-to-mina
```

Each task:

- builds the local CLI
- runs the single high-level `bridge` command directly, not through Vitest
- streams live progress from stderr while the bridge is waiting on the network
- validates the final JSON payload
- fails if the bridge does not complete successfully
- is expected to cover the unattended contract: start once, wait as long as needed, and eventually observe completion from that same CLI invocation

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
- If a proof request sits longer than about 20 minutes, the sequencer may evict it from memory and later return `Invalid key`. That is currently terminal and should be recorded as such.
- For deposits, a cancellable entry can never also be finalized. Cancellable deposits are skippable in protocol terms, but finalizable deposits must never be skipped.

## Artifacts

On success, the CLI returns final JSON on stdout. Keep:

- `operation_id`
- `log_path`
- final transaction hash

Those are the minimum details needed to debug a long-running bridge or inspect it with `operation logs`.
