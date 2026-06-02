# Bridge Validator

Cloudflare Worker service that periodically validates the published bridge CLI through the deployed Cloudflare Worker, Workflow, and Sandbox path.

## Runtime Contract

- Cron runs every 12 hours and alternates deposit and withdrawal workflows. The service does not start both routes at the same time because both routes use the configured wallet and concurrent runs can contend on nonce and bridge queue state.
- Set `BRIDGE_VALIDATOR_ENABLED=false` to disable scheduled runs while keeping authenticated manual starts available.
- Each workflow has a 2 hour timeout. The Cloudflare Sandbox command stops after 115 minutes so the Workflow has 5 minutes left for diagnostics, Slack reporting, and cleanup.
- The sandbox runs `zeko-bridge bridge --json --verbose` from the published bridge CLI package configured in `package.json` by default. For PR validation before an SDK/CLI release, set `BRIDGE_VALIDATOR_SOURCE_REPOSITORY` and `BRIDGE_VALIDATOR_SOURCE_REF`; the sandbox clones that source, builds `bridge-cli`, and runs the built CLI entrypoint for that run.
- Both validator routes use `2 MINA`. Keep the configured wallet funded enough to absorb bridge fees, account-creation fees, retries, and multiple scheduled runs.
- The Workflow starts one background command in Cloudflare Sandbox, records PID/output marker files, and polls those marker files until the command reaches a terminal status or the hard timeout is reached.
- The Workflow validates the CLI JSON result, then reads the CLI history log and confirms the submitted hashes and final transaction hash.
- Slack receives rich success or failure output with the configured wallet public key, route evidence, workflow duration, and bridge command duration. Failure stdout and stderr are uploaded as Slack text files in the message thread when present so diagnostics are not truncated. The sandbox is destroyed in the Workflow `finally` path.

## What It Proves

- The deployed Worker/Workflow/Sandbox path can run the latest published `zeko-bridge` command unattended.
- One real deposit route and one real withdrawal route can reach terminal CLI output.
- The validator enforces a 2 hour hard stop and cleans up its sandbox.
- The final transaction hash is present in both the CLI result and the referenced history log.

## What It Does Not Prove

- Browser wallet or bridge UI behavior.
- Cancellation-specific behavior beyond whatever the high-level CLI command performs.
- All bridge routes, all queue shapes, or unconditional protocol correctness.

## Required Configuration

- `BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY` in the repo `.env`, synced to the Cloudflare `WALLET_PRIVATE_KEY` secret
- `BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY` in the repo `.env`, synced to the Cloudflare `WALLET_PUBLIC_KEY` secret for reporting
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`
- `VALIDATOR_API_TOKEN`
- Optional for source-build validation: `BRIDGE_VALIDATOR_SOURCE_REPOSITORY`, `BRIDGE_VALIDATOR_SOURCE_REF`, and `GITHUB_TOKEN` when cloning a private GitHub repository

Use a configured funded validator wallet. Shared bridge test wallets often carry existing queues, which makes periodic validator runs noisy and can block finalization behind unrelated deposits. If `BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY` is absent, `sync-secrets` falls back to `WALLET_PRIVATE_KEY`, `ZEKO_BRIDGE_MINA_PRIVATE_KEY`, then numbered bridge keys.

`VALIDATOR_API_TOKEN` is required as a bearer token for every Worker HTTP endpoint, including `/bridge-status` and `/bridge-cleanup`. Operator Moon tasks read this token from `.env`; do not pass it inline.

Status and cleanup endpoints require an exact sandbox target. Use the attempt number from the Workflow step name `start bridge validation command attempt N`, or pass the full sandbox id. The endpoint intentionally does not scan all possible attempts because probing a Cloudflare Sandbox id can create a live container.

## Commands

Run from the monorepo root:

```bash
moon run bridge-validator:type-cf
moon run bridge-validator:test
moon run bridge-validator:typecheck
moon run bridge-validator:lint
moon run bridge-validator:build
moon run bridge-validator:deploy
```

Operator commands:

```bash
moon run bridge-validator:sync-secrets
moon run bridge-validator:trigger-deposit
moon run bridge-validator:trigger-withdrawal
moon run bridge-validator:start-deposit
moon run bridge-validator:start-withdrawal
moon run bridge-validator:list-instances
VALIDATOR_INSTANCE_ID=<id> moon run bridge-validator:describe-instance
VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:status
VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:status-logs
VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:cleanup
```

## Acceptance Evidence

A deployed run is accepted only when both a deposit and withdrawal complete through Cloudflare and report:

- Workflow instance ID
- `operation_id`
- final transaction hash, linked to the explorer when the CLI reports an explorer URL
- history `log_path`
- Slack success or failure output with the configured wallet public key, workflow timing, bridge command timing, and uploaded stdout/stderr files when diagnostics are present

Current deployed status for PR #150: the deposit route has completed through Cloudflare. The withdrawal route still needs a deployed Cloudflare run before the validator service is fully accepted end-to-end.
