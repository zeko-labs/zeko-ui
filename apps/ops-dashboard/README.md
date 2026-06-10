# Ops Dashboard

Unified dashboard for the actions indexer, L1/L2 archive endpoints, and L1/L2 daemon endpoints.

## Local Development

Run from the repository root:

```sh
moon run ops-dashboard:dev
```

The dashboard defaults to mainnet Zeko-operated endpoints. To enable authenticated indexer status and controls locally, set `ACTIONS_INDEXER_TOKEN` in the shell or in an untracked `.env` file before starting the dev server.

Endpoint overrides:

- `ACTIONS_INDEXER_URL`
- `L1_ARCHIVE_URL`
- `L2_ARCHIVE_URL`
- `L1_DAEMON_URL`
- `L2_DAEMON_URL`

## Deployment

Deploy through Moon:

```sh
moon run ops-dashboard:deploy
```

Set the indexer control token as a Cloudflare Worker secret:

```sh
pnpm --dir apps/ops-dashboard exec wrangler secret put ACTIONS_INDEXER_TOKEN --config wrangler.jsonc
```

Publish the Workers Builds trigger config through the project task:

```sh
moon run ops-dashboard:publish-cf-build-config
```

See `docs/OPS_DASHBOARD_ACCESS.md` for the required Cloudflare Access protection on `ops.zeko.io`.
