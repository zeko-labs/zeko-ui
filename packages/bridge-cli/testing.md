# Bridge CLI Testing

This file covers manual live validation only. Public usage documentation lives in [README.md](./README.md).

## Required Environment

Set these before running the manual live checks:

- `ZEKO_BRIDGE_MINA_PRIVATE_KEY`
- `ZEKO_BRIDGE_ZEKO_PRIVATE_KEY` if you do not want to reuse the Mina key

Example shell setup:

```bash
export ZEKO_BRIDGE_MINA_PRIVATE_KEY="<mina testnet private key>"
export ZEKO_BRIDGE_ZEKO_PRIVATE_KEY="<optional zeko testnet private key>"
```

## Manual Live Validation

Run from the monorepo root:

```bash
moon run bridge-cli:live-bridge-mina-to-zeko
moon run bridge-cli:live-bridge-zeko-to-mina
```

Each task:

- builds the local CLI
- runs the single high-level `bridge` command
- validates the final JSON payload
- fails if the bridge does not complete successfully

These checks are manual entrypoints only. They are excluded from the normal Vitest suite and are not run by CI.

## Interpreting Progress

During long waits, expect stderr progress lines for:

- submission
- waiting for confirmation
- waiting on earlier queued claims
- retries after transient network/status errors
- periodic heartbeat summaries

If the account already has pending bridge work, the command may report that it is advancing an earlier claim before it can complete the current request. That is expected bridge behavior.

## Artifacts

On success, the CLI returns final JSON on stdout. Keep:

- `operation_id`
- `log_path`
- final transaction hash

Those are the minimum details needed to debug a long-running bridge or inspect it with `operation logs`.
