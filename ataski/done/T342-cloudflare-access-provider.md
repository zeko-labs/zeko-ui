---
id: T342
title: "Cloudflare Access provider"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-13T02:45:00Z
updated_at: 2026-06-13T03:10:00Z
---

## Requirements

- Make the actions dashboard Cloudflare Access configuration use Cloudflare account-member authentication by default instead of GitHub organization authentication.
- Keep GitHub provider support available as an explicit override for future use.
- Update dashboard documentation and existing tests so the durable checked-in default matches the live Access configuration.
- Reconfigure the deployed `actions.dashboard.zeko.io` Access app to use the Cloudflare identity provider.

## Test Plan

- BDD: update the existing `configure-access` test expectations so the default run selects the Cloudflare identity provider and creates a Cloudflare account-member allow policy.
- RED path: run the targeted test before implementation and confirm the current default still selects GitHub.
- GREEN path: update the default/provider copy, run the targeted dashboard tests, re-run Cloudflare Access configuration, and verify the deployed Access app allows only the Cloudflare IdP.

## RED Evidence

- `moon run -f actions-dashboard:test -- -t "defaults Cloudflare Access"` failed because `configure-access.ts` still resolved the default provider to GitHub and threw `No GitHub Access identity provider exists`.

## GREEN Evidence

- `moon run -f actions-dashboard:test -- -t "defaults Cloudflare Access"` passed after changing the default provider to Cloudflare account-member auth.
- Loading the repo root `.env`, exporting `CLOUDFLARE_API_TOKEN="$CFZT_TOKEN"` and `CLOUDFLARE_ACCOUNT_ID=a12d2915bc16ee8550f19399839623f7`, then running `moon run -f actions-dashboard:configure-access` updated the live Access app to use the Cloudflare identity provider `3194dbc8-997a-4f63-a9db-ecab753a75f7`.
- Cloudflare API verification showed `actions.dashboard.zeko.io` now has `allowed_idps: ["3194dbc8-997a-4f63-a9db-ecab753a75f7"]` and an allow policy with `cloudflare_account_member.account_id = a12d2915bc16ee8550f19399839623f7`.
- `moon run -f actions-dashboard:test` passed: 27 tests.
- `moon run -f actions-dashboard:typecheck actions-dashboard:lint actions-dashboard:build` passed.
