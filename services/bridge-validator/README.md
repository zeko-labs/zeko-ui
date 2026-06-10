# Bridge Validator

Cloudflare Worker service that validates the published bridge CLI through the deployed Worker, Workflow, and Sandbox path.

## Schedule

- Cron cadence is configured only in `wrangler.jsonc` under `triggers.crons`.
- Each scheduled event starts one workflow.
- Route choice alternates by scheduled timestamp, so adjacent scheduled runs use different routes when the route alternation interval matches the cron cadence.
- Disable automatic cron work with `BRIDGE_VALIDATOR_ENABLED=false`. Authenticated manual starts still work.

## Runtime Contract

- Each run executes one route for `2 MINA`: `mina:testnet -> zeko:testnet` deposit or `zeko:testnet -> mina:testnet` withdrawal.
- The sandbox runs `zeko-bridge bridge --json --verbose` from the published CLI package in `package.json`.
- PR validation can set `BRIDGE_VALIDATOR_SOURCE_REPOSITORY` and `BRIDGE_VALIDATOR_SOURCE_REF`; the sandbox then clones that source, builds `bridge-cli`, and runs the built entrypoint.
- Workflow timeout is 2 hours. The sandbox command is capped at 115 minutes, leaving 5 minutes for diagnostics, Slack reporting, and cleanup.
- The Workflow validates the CLI JSON result, reads the CLI history log, confirms submitted hashes and final hash, posts Slack, and destroys the sandbox in `finally`.
- The bridge CLI must only submit a fresh operation when its route queue is empty.

## Wallet

Use the dedicated validator wallet, not shared bridge test wallets. Shared wallets often carry old queue work and make validator runs noisy.

- Source env keys: `BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY` and `BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY`.
- Cloudflare secret names after sync: `WALLET_PRIVATE_KEY` and `WALLET_PUBLIC_KEY`.
- Keep enough MINA on both Mina L1 and Zeko L2 for 2 MINA operations, fees, retries, and account-creation costs. A practical floor is at least 10 MINA on each side for unattended testnet operation.

## Configuration

`services/bridge-validator/.env.example` is the authoritative local env list. `moon run bridge-validator:sync-secrets` reads the repo `.env` by default and writes only Cloudflare secrets.

Required:

| Key                                   | Used for                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY` | Preferred signer source, synced as `WALLET_PRIVATE_KEY`.                                |
| `BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY`  | Reporting key, synced as `WALLET_PUBLIC_KEY`.                                           |
| `SLACK_BOT_TOKEN`                     | Slack `chat.postMessage`, `files.getUploadURLExternal`, `files.completeUploadExternal`. |
| `SLACK_CHANNEL_ID`                    | Slack delivery channel.                                                                 |
| `VALIDATOR_API_TOKEN`                 | Bearer token for every Worker HTTP endpoint and operator task.                          |

Optional:

| Key                                       | Used for                                                      |
| ----------------------------------------- | ------------------------------------------------------------- |
| `BRIDGE_VALIDATOR_ENABLED`                | Enables scheduled cron work unless set to false-like values.  |
| `BRIDGE_VALIDATOR_BASE_URL`               | Operator scripts target URL; defaults to the deployed Worker. |
| `BRIDGE_VALIDATOR_SOURCE_REPOSITORY`      | Source-build validation repository.                           |
| `BRIDGE_VALIDATOR_SOURCE_REF`             | Source-build validation ref.                                  |
| `GITHUB_TOKEN`                            | Private GitHub source-build clone auth.                       |
| `WALLET_PRIVATE_KEY`, `WALLET_PUBLIC_KEY` | Backward-compatible wallet fallback for secret sync.          |
| `ZEKO_BRIDGE_MINA_PRIVATE_KEY*`           | Last-resort shared wallet fallback; avoid for scheduled runs. |

Slack bot scopes must include `chat:write` and `files:write`. Add channel membership or Slack channel scopes as needed for the configured `SLACK_CHANNEL_ID`.

## Commands

Run all tasks from the monorepo root.

Validation:

```bash
moon run bridge-validator:test -f
moon run bridge-validator:typecheck -f
moon run bridge-validator:lint -f
moon run bridge-validator:build -f
moon run bridge-validator:type-cf -f
```

Deploy and secrets:

```bash
moon run bridge-validator:sync-secrets -f
moon run bridge-validator:deploy
```

Manual runs:

```bash
moon run bridge-validator:trigger-deposit
moon run bridge-validator:trigger-withdrawal
moon run bridge-validator:start-deposit
moon run bridge-validator:start-withdrawal
```

Inspection and cleanup:

```bash
moon run bridge-validator:list-instances
VALIDATOR_INSTANCE_ID=<id> moon run bridge-validator:describe-instance
VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:status
VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:status-logs
VALIDATOR_INSTANCE_ID=<id> VALIDATOR_SANDBOX_ATTEMPT=<n> moon run bridge-validator:cleanup
```

Use the attempt number from `start bridge validation command attempt N`, or set `VALIDATOR_SANDBOX_ID` for a full sandbox id. Do not scan attempts; probing a Cloudflare Sandbox id can create a live container.

## Acceptance Evidence

A deployed validation is accepted only when both routes complete through Cloudflare and report:

- Workflow instance ID.
- `operation_id`.
- final transaction hash and explorer URL when the CLI reports one.
- history `log_path`.
- Slack success or failure output with wallet public key, workflow timing, command timing, and diagnostic files when present.
