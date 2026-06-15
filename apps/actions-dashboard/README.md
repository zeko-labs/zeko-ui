# Actions Dashboard

Unified dashboard for the actions indexer, L1/L2 archive endpoints, and L1/L2 daemon endpoints.

## Local Development

Run from the repository root:

```sh
moon run actions-dashboard:dev
```

The dashboard defaults to mainnet and can switch to testnet from the page header. To enable authenticated indexer status and controls locally, set `ACTIONS_INDEXER_TOKEN` for both networks or `MAINNET_ACTIONS_INDEXER_TOKEN` / `TESTNET_ACTIONS_INDEXER_TOKEN` for network-specific control tokens in the shell or in an untracked `.env` file before starting the dev server.

Endpoint overrides:

- `MAINNET_ACTIONS_INDEXER_URL`
- `MAINNET_L1_ARCHIVE_URL`
- `MAINNET_L2_ARCHIVE_URL`
- `MAINNET_L1_DAEMON_URL`
- `MAINNET_L2_DAEMON_URL`
- `TESTNET_ACTIONS_INDEXER_URL`
- `TESTNET_L1_ARCHIVE_URL`
- `TESTNET_L2_ARCHIVE_URL`
- `TESTNET_L1_DAEMON_URL`
- `TESTNET_L2_DAEMON_URL`

`*_ACTIONS_INDEXER_URL` is the public URL shown in the dashboard and used by
server-side probes and controls. The Worker enables Cloudflare's
`global_fetch_strictly_public` compatibility flag so same-zone `zeko.io`
subrequests use the public route instead of the zone origin path.

## Deployment

Configure Cloudflare Access before deploying the custom domain. The task expects
an API token scoped to the Zeko Cloudflare account with:

- `Access: Apps and Policies Edit`
- `Access: Identity Providers Read`
- `Access: Organizations, Identity Providers, and Groups Write`

```sh
export CLOUDFLARE_API_TOKEN=... # or CFZT_TOKEN
export CLOUDFLARE_ACCOUNT_ID=...
moon run actions-dashboard:configure-access
```

The default provider is Cloudflare account membership for the Zeko Cloudflare
account. To use GitHub org membership for `zeko-labs` instead, set
`ACTIONS_DASHBOARD_ACCESS_PROVIDER=github`. The GitHub login method must be
backed by a GitHub OAuth App with the callback URL from Cloudflare Access. If
more than one GitHub identity provider exists, also set
`ACTIONS_DASHBOARD_GITHUB_IDP_ID`.

Deploy through Moon:

```sh
moon run actions-dashboard:deploy
```

Set the indexer control token as Cloudflare Worker secrets:

```sh
pnpm --dir apps/actions-dashboard exec wrangler secret put MAINNET_ACTIONS_INDEXER_TOKEN --config wrangler.jsonc
pnpm --dir apps/actions-dashboard exec wrangler secret put TESTNET_ACTIONS_INDEXER_TOKEN --config wrangler.jsonc
```

Publish the Workers Builds trigger config through the project task:

```sh
moon run actions-dashboard:publish-cf-build-config
```

See `docs/ACTIONS_DASHBOARD_ACCESS.md` for the required Cloudflare Access protection on `actions.dashboard.zeko.io`.
