# Ops Dashboard Cloudflare Access

The ops dashboard Worker is configured for `ops.zeko.io` in `apps/ops-dashboard/wrangler.jsonc`. Protect that hostname with a Cloudflare Access self-hosted application before or immediately after first deploy.

## Preferred Policy

Use GitHub OAuth and restrict access to the `zeko-labs` organization.

Cloudflare's GitHub Access setup requires a GitHub OAuth app with:

- Homepage URL: `https://<team-name>.cloudflareaccess.com`
- Callback URL: `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback`

After adding the GitHub identity provider in Cloudflare Zero Trust, create an Access application:

- Type: Self-hosted
- Application domain: `ops.zeko.io`
- Login method: GitHub
- Policy action: Allow
- Include selector: GitHub organization
- Organization: `zeko-labs`
- Session duration: 24h

Cloudflare requests GitHub read-only organization/team and email permissions for this login method. If a newly added org member is blocked after a prior failed login, they need to revoke the OAuth app in GitHub and authenticate again so Access refreshes their organization membership.

## Alternative Policy

Use Cloudflare as the identity provider and restrict authentication to Cloudflare account members.

Create or reuse a Cloudflare identity provider with `restrict_to_account_members` enabled, then create an Access application:

- Type: Self-hosted
- Application domain: `ops.zeko.io`
- Login method: Cloudflare
- Policy action: Allow
- Include selector: Cloudflare account member
- Account: current Zeko Cloudflare account
- Session duration: 24h

## Secrets

Set the actions indexer token as a Worker secret, not as a checked-in variable:

```sh
pnpm --dir apps/ops-dashboard exec wrangler secret put ACTIONS_INDEXER_TOKEN --config wrangler.jsonc
```

## Workers Builds

Publish the checked-in Workers Builds trigger config through Moon:

```sh
moon run ops-dashboard:publish-cf-build-config
```

## References

- Cloudflare GitHub identity provider: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/github/
- Cloudflare as identity provider: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/
- Cloudflare Access policies: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
