# Ops Dashboard

Unified dashboard for the actions indexer, L1/L2 archive endpoints, and L1/L2 daemon endpoints.

## Local Development

Run from the repository root:

```sh
moon run ops-dashboard:dev
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

## Deployment

Configure Cloudflare Access before deploying the custom domain. The task expects
an API token scoped to the Zeko Cloudflare account with:

- `Access: Apps and Policies Edit`
- `Access: Identity Providers Read`
- `Access: Organizations, Identity Providers, and Groups Write`

```sh
export CLOUDFLARE_API_TOKEN=... # or CFZT_TOKEN
export CLOUDFLARE_ACCOUNT_ID=...
moon run ops-dashboard:configure-access
```

The default provider is GitHub org membership for `zeko-labs`. The GitHub login
method must be backed by a GitHub OAuth App with the callback URL from
Cloudflare Access. If more than one GitHub identity provider exists, also set
`OPS_DASHBOARD_GITHUB_IDP_ID`. To use Cloudflare account membership as an
explicit fallback, set `OPS_DASHBOARD_ACCESS_PROVIDER=cloudflare`.

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
