# Bridge Validator

Internal Cloudflare Worker service for scheduled real-network validation of the published `@zeko-labs/bridge-cli`.

The validator runs only the single high-level bridge command inside Cloudflare Sandbox:

```bash
npx -y @zeko-labs/bridge-cli@latest bridge --from ... --to ... --amount 1 --json
```

It does not orchestrate low-level bridge commands. The point is to validate the default agent path.

## Runtime Model

- Cloudflare Cron Trigger fires every 6 hours
- the Worker creates exactly two Workflow instances
- each Workflow starts one Sandbox process running the published `bridge` command
- the Workflow polls the Sandbox process durably until the command finishes
- failures are posted to Slack

There is no GitHub-triggered scheduler and no Inngest dependency anymore.

## Required Environment

Start from `.env.example`.

Required secrets:

- `ZEKO_BRIDGE_MINA_PRIVATE_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`

Optional secret:

- `ZEKO_BRIDGE_ZEKO_PRIVATE_KEY`

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

## Cloudflare Deploy Commands

Set the validator secrets in your shell first:

```bash
export ZEKO_BRIDGE_MINA_PRIVATE_KEY='<mina testnet private key>'
export ZEKO_BRIDGE_ZEKO_PRIVATE_KEY='<optional zeko testnet private key>'
export SLACK_BOT_TOKEN='xoxb-...'
export SLACK_CHANNEL_ID='C0123456789'
```

Push those into Wrangler:

```bash
printf '%s' "$ZEKO_BRIDGE_MINA_PRIVATE_KEY" | pnpm exec wrangler secret put ZEKO_BRIDGE_MINA_PRIVATE_KEY --config services/bridge-validator/wrangler.jsonc
printf '%s' "$ZEKO_BRIDGE_ZEKO_PRIVATE_KEY" | pnpm exec wrangler secret put ZEKO_BRIDGE_ZEKO_PRIVATE_KEY --config services/bridge-validator/wrangler.jsonc
printf '%s' "$SLACK_BOT_TOKEN" | pnpm exec wrangler secret put SLACK_BOT_TOKEN --config services/bridge-validator/wrangler.jsonc
printf '%s' "$SLACK_CHANNEL_ID" | pnpm exec wrangler secret put SLACK_CHANNEL_ID --config services/bridge-validator/wrangler.jsonc
```

Generate types and deploy:

```bash
moon run bridge-validator:type-cf
pnpm exec wrangler deploy --config services/bridge-validator/wrangler.jsonc
```

Trigger one route manually after deploy:

```bash
pnpm exec wrangler workflows trigger bridge-validator '{"routeKey":"mina-to-zeko"}' --config services/bridge-validator/wrangler.jsonc
pnpm exec wrangler workflows trigger bridge-validator '{"routeKey":"zeko-to-mina"}' --config services/bridge-validator/wrangler.jsonc
```

List recent workflow instances:

```bash
pnpm exec wrangler workflows instances list bridge-validator --config services/bridge-validator/wrangler.jsonc
```

## Slack Bot Setup

The repo includes a ready manifest at [slack-app-manifest.json](./slack-app-manifest.json).

1. In Slack, create an app config token for your workspace.
   Open:

```bash
open 'https://api.slack.com/apps'
```

Then create an app config token with scope `apps.manifest:write`.
2. Export it:

```bash
export SLACK_APP_CONFIG_TOKEN='xoxe.xoxc-...'
```

3. Create the app from the manifest:

```bash
curl -sS -X POST https://slack.com/api/apps.manifest.create \
  -H "Authorization: Bearer $SLACK_APP_CONFIG_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data @services/bridge-validator/slack-app-manifest.json | tee /tmp/bridge-validator-slack-app.json
```

4. Open the created app in Slack and install it to the workspace.
5. Copy the Bot User OAuth Token from the installed app and export it as `SLACK_BOT_TOKEN`.
6. Invite the bot to the target channel:

```text
/invite @Zeko Bridge Validator
```

7. Resolve the channel ID:

```bash
curl -sS https://slack.com/api/conversations.list?types=public_channel,private_channel\&limit=999 \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  | jq -r '.channels[] | [.name, .id] | @tsv'
```

Use the matching channel ID as `SLACK_CHANNEL_ID`.

## Related Docs

- public bridge CLI usage: [`packages/bridge-cli/README.md`](../../packages/bridge-cli/README.md)
- manual bridge validation: [`packages/bridge-cli/testing.md`](../../packages/bridge-cli/testing.md)

## Operator Checklist

1. Export local funded testnet keys and run the CLI manually first:

```bash
export ZEKO_BRIDGE_MINA_PRIVATE_KEY='<mina testnet private key>'
export ZEKO_BRIDGE_ZEKO_PRIVATE_KEY='<optional zeko testnet private key>'
moon run bridge-cli:live-bridge-mina-to-zeko
moon run bridge-cli:live-bridge-zeko-to-mina
```

2. Claim the npm package name if this is still the first publish:

```bash
npm login
bun scripts/npm-init-publish.ts packages/bridge-cli --otp 123456
```

3. Configure npm Trusted Publisher for `@zeko-labs/bridge-cli` at:

```bash
open 'https://www.npmjs.com/package/@zeko-labs/bridge-cli/access'
```

Use:

- organization `zeko-labs`
- repository `zeko-ui`
- workflow filename `changesets.yaml`

4. Release the package version that the validator should execute:

```bash
gh workflow run "Release Bridge CLI" --ref canonical/bridge-cli
gh run watch --exit-status
```

5. Create and install the Slack bot, then capture `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID`.
6. Push the validator secrets with `wrangler secret put`.
7. Deploy the Worker with `wrangler deploy`.
8. Trigger both workflow directions manually once and confirm they show up in `wrangler workflows instances list`.
9. Leave the Cloudflare cron trigger enabled for the ongoing 6-hour schedule.
