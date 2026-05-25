# Bridge Validator

Internal Cloudflare Worker service for scheduled real-network validation of the published `@zeko-labs/bridge-cli`.

The validator runs the high-level `bridge` command through Cloudflare Workflows and Cloudflare Sandbox. The Workflow owns orchestration, validation, cleanup, and Slack reporting. The Sandbox runs one published CLI command.

## How It Runs

1. Cloudflare Cron triggers the Worker every 6 hours via `0 */6 * * *`.
2. The Worker creates exactly two Workflow runs per tick:
   - one `mina-to-zeko` deposit validation
   - one `zeko-to-mina` withdrawal validation
3. The sandbox image installs `@zeko-labs/bridge-cli@latest` directly during the Docker build.
4. The Workflow validates a `2` MINA bridge amount. This keeps the validation above the proof-fee edge while still using a small testnet amount.
5. The Workflow creates a Cloudflare Sandbox, explicitly sets `setKeepAlive(true)` on that sandbox instance, writes a tiny shell runner, and starts one background Sandbox command:

```bash
nohup bash /workspace/bridge-validator/run-bridge.sh >/workspace/bridge-validator/process.log 2>&1 &
```

The runner executes exactly one published bridge CLI invocation:

```bash
timeout -k 30s -s TERM 7200s node "$(readlink -f "$(command -v zeko-bridge)")" bridge --from mina:testnet --to zeko:testnet --amount 2 --json --verbose
```

The command resolves the published package entrypoint with `readlink -f "$(command -v zeko-bridge)"` and runs it with `node`. This keeps the validator on the real published package while avoiding shell-shim differences between local npm and the Sandbox image. The command is wrapped with GNU `timeout` so the container process cannot run past the hard 2-hour timeout.

6. Worker secrets are loaded before the bridge command starts:
   - `WALLET_PRIVATE_KEY`, injected into the process as both `WALLET_PRIVATE_KEY` for the currently published CLI and `MINA_PRIVATE_KEY` for the current source CLI contract
   - `SLACK_BOT_TOKEN`
   - `SLACK_CHANNEL_ID`
7. The start step returns immediately. The Workflow then waits on `step.waitForEvent` for up to two hours.
8. When the CLI exits, the runner posts one callback to `/bridge-callback` with the Workflow instance ID, callback token, exit code, stdout, and stderr. The Workflow rejects callbacks that do not match the stored token.
9. If the command exits non-zero, the event times out, or the Workflow step fails, the Workflow reports failure to Slack and destroys the sandbox.
10. When the command exits successfully, the Workflow:

- parses stdout as the bridge JSON result
- requires the expected route, direction, amount, submitted transactions, final transaction, and `log_path`
- reads the JSONL history log from `result.log_path`
- confirms submitted hashes and final hash against that history log

11. The Workflow posts Slack success or failure messages with the route, resolved CLI version, and validation artifacts.
12. The Workflow destroys the `keepAlive` sandbox at the end of every run, whether the run succeeded, failed, or timed out.

Operators can inspect whether a live Sandbox command is still running without reading bridge logs:

```bash
curl 'https://bridge-validator.zeko-labs.workers.dev/bridge-status?instanceId=<workflow-instance-id>'
```

## What This Proves

- one unattended deposit through the published CLI on `mina-to-zeko`
- one unattended withdrawal through the published CLI on `zeko-to-mina`
- Cloudflare Workflow can run the published CLI through the deployed Sandbox command path
- unattended runs have a hard stop after 120 minutes instead of leaking forever
- the published CLI JSON result matches the validator contract
- the referenced bridge history log matches the submitted hashes and final transaction hash
- Slack reporting carries the evidence needed for operators

## What This Does Not Prove

- cancellation behavior
- seeded queue-draining scenarios unless operators intentionally create them
- browser-wallet or `apps/bridge-ui` behavior
- unconditional bridge correctness

## Required Environment

Start from [`.env.example`](./.env.example).

Required local secrets:

- `ZEKO_BRIDGE_MINA_PRIVATE_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`

`ZEKO_BRIDGE_MINA_PRIVATE_KEY` must belong to a dedicated funded validator wallet. The sync script writes it to the Cloudflare `WALLET_PRIVATE_KEY` secret consumed by the Worker. `WALLET_PRIVATE_KEY` is still accepted as a backward-compatible local alias, but if both local variables are set they must match.

Do not reuse a wallet with unresolved bridge deposits or withdrawals: the published CLI correctly advances/resolves pending queue state in order, so stale wallet state can consume the full two-hour validator window before the requested validation route reaches a terminal transaction.

Local secret sync defaults to the repo-root [`.env`](../../.env):

```bash
bash services/bridge-validator/scripts/push-secrets-from-env.sh
```

Override the env file explicitly if needed:

```bash
bash services/bridge-validator/scripts/push-secrets-from-env.sh services/bridge-validator/.env services/bridge-validator/wrangler.jsonc
```

## Merge Gates

```bash
moon run bridge-validator:type-cf
moon run bridge-validator:test
moon run bridge-validator:typecheck
moon run bridge-validator:lint
moon run bridge-validator:build
```

Automated tests must cover:

- `keepAlive` sandbox runtime configuration
- 2-hour workflow hard timeout and cleanup behavior
- command construction for the published latest bridge command
- Sandbox command start and callback capture
- live Sandbox command status inspection
- JSON parsing, history-log reading, and bridge result validation
- Slack success and failure payload generation

If [`wrangler.jsonc`](./wrangler.jsonc) changes, regenerate and commit [`worker-configuration.d.ts`](./worker-configuration.d.ts):

```bash
moon run bridge-validator:type-cf
```

## Pre-Deploy Manual Validation

1. Push real Worker secrets to Cloudflare.
2. Deploy the Worker.
3. Wait for the container rollout to settle before triggering validation. A run started during rollout can be killed by Cloudflare with `Runtime signalled the container to exit due to a new version rollout`.
4. Trigger `mina-to-zeko` once.
5. Trigger `zeko-to-mina` once.
6. Confirm the deployed Workflow command reaches a terminal result.
7. Confirm each successful run reports:
   - Workflow instance ID
   - `operation_id`
   - `final_transaction.hash`
   - `log_path`
   - validated history-log match
8. Confirm Slack success messages arrive with the route and final artifacts.
9. Confirm timed-out or failed runs exit on their own without leaving the Workflow or sandbox alive indefinitely.
10. If either run cannot complete through the deployed Sandbox command path, treat that as a hard failure of the deployed Cloudflare validator path.

Helpful commands:

```bash
pnpm exec wrangler workflows trigger bridge-validator '{"routeKey":"mina-to-zeko"}' --config services/bridge-validator/wrangler.jsonc
pnpm exec wrangler workflows trigger bridge-validator '{"routeKey":"zeko-to-mina"}' --config services/bridge-validator/wrangler.jsonc
pnpm exec wrangler workflows instances list bridge-validator --config services/bridge-validator/wrangler.jsonc
```

## Funded Live Bridge Evidence

The PR is not validated until operators attach or link evidence for:

- one successful deposit run
- one successful withdrawal run
- the Workflow instance ID for both runs
- the `operation_id` for both runs
- the final transaction hash for both runs
- the `log_path` for both runs
- confirmation that each run completed through the deployed Sandbox command path

## Local Project Commands

Run from the monorepo root:

```bash
moon run bridge-validator:type-cf
moon run bridge-validator:typecheck
moon run bridge-validator:test
moon run bridge-validator:lint
moon run bridge-validator:build
```

For local Worker dev:

```bash
moon run bridge-validator:dev
```
