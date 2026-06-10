---
id: T318
title: "Fix Access IdP login"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T15:22:45Z
updated_at: 2026-06-10T15:27:09Z
---

## Requirements

- Fix the deployed `ops.zeko.io` Cloudflare Access login error.
- Avoid relying on the current GitHub IdP if it cannot fetch GitHub user/org information.
- Keep the app restricted to the Zeko organization boundary using Cloudflare account membership if GitHub org auth is broken.
- Preserve a programmatic, repeatable Access configuration task.

## Test Plan

- DDD: inspect Access IdP/policy state, update the automation to configure Cloudflare account-member auth, apply it through `CFZT_TOKEN`, and verify unauthenticated HTTP redirects to Access without the broken GitHub-only policy.

## RED Evidence

- After GitHub login, Cloudflare Access returns `400 Authentication Error: Failed to fetch user/group information from the identity provider`.
- Cloudflare docs state that this error occurs when Cloudflare lacks the API permissions needed to communicate with the IdP.
- The existing GitHub IdP is present, but the org policy requires GitHub org/team information that the login flow cannot fetch.

## GREEN Evidence

- Updated the repeatable Access configuration task so Cloudflare account membership is the default provider, while GitHub org auth remains available with `OPS_DASHBOARD_ACCESS_PROVIDER=github`.
- Applied the task with `CFZT_TOKEN` and the Zeko Cloudflare account ID.
- Created Cloudflare Access IdP `3194dbc8-997a-4f63-a9db-ecab753a75f7`.
- Updated Access app `e597d623-7762-43cf-bbbf-6b976f38ee17` for `ops.zeko.io` to allow only the Cloudflare IdP and auto-redirect to it.
- Rewrote policy `56d1dec5-3604-4c15-ba50-a90e082a6970` as `Allow Zeko Cloudflare account` with `cloudflare_account_member.account_id`.
- Reran `moon run ops-dashboard:configure-access` successfully to verify the existing-IdP update path is idempotent.
- Verified the Cloudflare API state: the app has one allowed IdP of type `cloudflare` and one allow policy using `cloudflare_account_member`.
- Verified `curl -I https://ops.zeko.io` returns a Cloudflare Access `302` redirect with `WWW-Authenticate: Cloudflare-Access`.

## Validation

- `pnpm exec dprint fmt apps/ops-dashboard/scripts/configure-access.ts apps/ops-dashboard/README.md ataski/done/T318-fix-access-idp-login.md ataski/tasks.md`
- `moon run ops-dashboard:lint`
- `moon run ops-dashboard:typecheck`
- `moon run ops-dashboard:configure-access`
