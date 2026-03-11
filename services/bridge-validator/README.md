# Bridge Validator

Internal service for scheduled real-network validation of the published `@zeko-labs/bridge-cli`.

The validator uses Inngest Cloud and runs only the single high-level bridge command:

```bash
npx -y @zeko-labs/bridge-cli@<version> bridge --from ... --to ... --amount 1 --json
```

It does not orchestrate low-level bridge commands. The point is to validate the default agent path.

## What It Runs

Each scheduled execution dispatches exactly two workflows:

- `mina:testnet -> zeko:testnet`
- `zeko:testnet -> mina:testnet`

Each workflow:

- receives the exact published CLI version to validate
- runs `bridge --json`
- treats `success=true` and `status=completed` as success
- posts to Slack only on failure

## Required Environment

Start from `.env.example`.

Required:

- `ZEKO_BRIDGE_MINA_PRIVATE_KEY`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`

Optional:

- `ZEKO_BRIDGE_ZEKO_PRIVATE_KEY`

## Local Service Commands

From the monorepo root:

```bash
moon run bridge-validator:build
moon run bridge-validator:typecheck
moon run bridge-validator:test
moon run bridge-validator:start
```

## Related Docs

- public bridge CLI usage: [`packages/bridge-cli/README.md`](../../packages/bridge-cli/README.md)
- manual bridge validation: [`packages/bridge-cli/testing.md`](../../packages/bridge-cli/testing.md)

## Operator Setup Checklist

1. Create the Inngest Cloud app and copy `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.
2. Create a Slack bot token and determine the target `SLACK_CHANNEL_ID`.
3. Set `ZEKO_BRIDGE_MINA_PRIVATE_KEY` and optionally `ZEKO_BRIDGE_ZEKO_PRIVATE_KEY` in the validator runtime.
4. Publish or confirm the npm bridge-cli version that the validator should execute.
5. Add the GitHub Actions secret used to dispatch the two scheduled Inngest events.
