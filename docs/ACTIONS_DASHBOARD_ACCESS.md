# Actions Dashboard Cloudflare Access

The actions dashboard Worker is configured for `actions.dashboard.zeko.io` in `apps/actions-dashboard/wrangler.jsonc`. Protect that hostname with a Cloudflare Access self-hosted application before or immediately after first deploy.

Because `actions.dashboard.zeko.io` is a multi-level subdomain, the hostname also needs Cloudflare edge certificate coverage beyond the default apex / first-level wildcard certificate. Use Advanced Certificate Manager or Total TLS so the hostname can complete TLS before Access redirects.

## Preferred Policy

Use Cloudflare as the identity provider and restrict authentication to Cloudflare account members.

Create or reuse a Cloudflare identity provider with `restrict_to_account_members` enabled, then create an Access application:

- Type: Self-hosted
- Application domain: `actions.dashboard.zeko.io`
- Login method: Cloudflare
- Policy action: Allow
- Include selector: Cloudflare account member
- Account: current Zeko Cloudflare account
- Session duration: 24h

The checked-in `actions-dashboard:configure-access` task uses this provider by default.

## GitHub Policy

Use GitHub OAuth and restrict access to the `zeko-labs` organization.

Cloudflare's GitHub Access setup requires a GitHub OAuth app with:

- Homepage URL: `https://<team-name>.cloudflareaccess.com`
- Callback URL: `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`

After adding the GitHub identity provider in Cloudflare Zero Trust, create an Access application:

- Type: Self-hosted
- Application domain: `actions.dashboard.zeko.io`
- Login method: GitHub
- Policy action: Allow
- Include selector: GitHub organization
- Organization: `zeko-labs`
- Session duration: 24h

Cloudflare requests GitHub read-only organization/team and email permissions for this login method. If a newly added org member is blocked after a prior failed login, they need to revoke the OAuth app in GitHub and authenticate again so Access refreshes their organization membership.

## Secrets

Set actions indexer control tokens as Worker secrets, not checked-in variables. Use network-specific secrets when mainnet and testnet have different tokens; otherwise `ACTIONS_INDEXER_TOKEN` is still accepted as a shared fallback.

```sh
pnpm --dir apps/actions-dashboard exec wrangler secret put ACTIONS_INDEXER_TOKEN --config wrangler.jsonc
pnpm --dir apps/actions-dashboard exec wrangler secret put MAINNET_ACTIONS_INDEXER_TOKEN --config wrangler.jsonc
pnpm --dir apps/actions-dashboard exec wrangler secret put TESTNET_ACTIONS_INDEXER_TOKEN --config wrangler.jsonc
```

## Workers Builds

Publish the checked-in Workers Builds trigger config through Moon:

```sh
moon run actions-dashboard:publish-cf-build-config
```

## References

- Cloudflare GitHub identity provider: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/github/
- Cloudflare as identity provider: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/
- Cloudflare Access policies: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
