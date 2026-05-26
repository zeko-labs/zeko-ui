# Bridge Validator

Cloudflare Worker service that periodically validates the published bridge CLI through the deployed Cloudflare Worker, Workflow, and Sandbox path.

## Runtime Contract

- Cron runs every 6 hours and creates one deposit workflow plus one withdrawal workflow.
- Each workflow has a 2 hour timeout. The Cloudflare Sandbox command stops after 115 minutes so timeout callbacks have 5 minutes to reach the Workflow before the hard stop.
- The sandbox runs `zeko-bridge bridge --json --verbose` from the published `@zeko-labs/bridge-cli@latest` package installed in the container image.
- The runner posts one authenticated callback to the Worker when the CLI exits. A sandbox watchdog posts a timeout callback if the command does not finish first.
- The Workflow validates the CLI JSON result, then reads the CLI history log and confirms the submitted hashes and final transaction hash.
- Slack receives success or failure output. The sandbox is destroyed in the Workflow `finally` path.

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

- `WALLET_PRIVATE_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`
- `VALIDATOR_API_TOKEN`
- `BRIDGE_VALIDATOR_BASE_URL`

`VALIDATOR_API_TOKEN` is required as a bearer token for every Worker HTTP endpoint, including `/bridge-status` and `/bridge-callback`.
`BRIDGE_VALIDATOR_BASE_URL` is the deployed Worker base URL used by the sandbox callback.

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
moon run bridge-validator:list-instances
VALIDATOR_INSTANCE_ID=<id> moon run bridge-validator:describe-instance
VALIDATOR_INSTANCE_ID=<id> VALIDATOR_API_TOKEN=<token> moon run bridge-validator:status
VALIDATOR_INSTANCE_ID=<id> VALIDATOR_API_TOKEN=<token> moon run bridge-validator:status-logs
```

## Acceptance Evidence

A deployed run is accepted only when both a deposit and withdrawal complete through Cloudflare and report:

- Workflow instance ID
- `operation_id`
- final transaction hash
- history `log_path`
- Slack success or failure output
