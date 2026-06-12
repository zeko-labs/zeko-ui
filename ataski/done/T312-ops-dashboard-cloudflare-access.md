---
id: T312
title: "ops-dashboard-cloudflare-access"
status: done
blockedBy: [T298]
owner: codex
created_at: 2026-06-10T11:16:29Z
updated_at: 2026-06-10T11:32:18Z
---

## Requirements

- Add Cloudflare Worker deployment config for the ops dashboard using this repo's existing Wrangler and Workers Builds patterns.
- Add a Moon project task surface for dev, build, typecheck, deploy, deploy-preview, and Workers Builds trigger publishing.
- Configure the dashboard for the custom hostname `ops.zeko.io` unless an existing repo convention requires a different name.
- Provide Cloudflare Access configuration artifacts or documented commands for protecting the dashboard with either a Cloudflare account OAuth identity provider or GitHub OAuth restricted to the `zeko-labs` organization.
- Do not call Cloudflare APIs directly from ad hoc scripts; checked-in config and documented operator steps are acceptable where this repo has no existing Access IaC.
- Keep secrets out of committed files. The indexer token, GitHub OAuth client secret, Cloudflare account ID, and zone ID must be supplied by environment variables or operator-managed secrets.

## Test Plan

- DDD: first verify there is no `ops-dashboard` Cloudflare deployment config or Access runbook.
- After implementation, run app-specific build/typecheck through Moon and dry-run the Workers Builds sync config if credentials/tooling allow it.
- If Cloudflare Access cannot be applied from this environment because credentials are unavailable, record the blocker and the exact operator command/config path.

## RED Evidence

- `test ! -f apps/ops-dashboard/wrangler.jsonc` confirmed no dashboard Wrangler config exists.
- `test ! -f apps/ops-dashboard/workers-build.jsonc` confirmed no dashboard Workers Builds config exists.
- `rg -n "ops-dashboard|ops\\.zeko\\.io|Cloudflare Access|zero trust|zeko-labs" apps/ops-dashboard docs packages services .github` found the new app package/Moon files but no deployment config or Access runbook.

## GREEN Evidence

- Added `apps/ops-dashboard/wrangler.jsonc` for the `ops-dashboard` Worker, `ops.zeko.io` route, Cloudflare module output, static asset binding, and non-secret endpoint variables.
- Added `apps/ops-dashboard/workers-build.jsonc` plus Moon tasks for deploy, preview deploy, and `publish-cf-build-config`.
- Added `docs/OPS_DASHBOARD_ACCESS.md` with GitHub OAuth restricted to the `zeko-labs` organization as the preferred Access policy and Cloudflare account membership as the fallback policy.
- `node -e "JSON.parse(require('node:fs').readFileSync('apps/ops-dashboard/wrangler.jsonc', 'utf8')); JSON.parse(require('node:fs').readFileSync('apps/ops-dashboard/workers-build.jsonc', 'utf8'))"` passed.
- `moon run -f ops-dashboard:build` passed.
- `pnpm --dir apps/ops-dashboard exec wrangler deploy --dry-run --config wrangler.jsonc` passed and reported the expected Worker bindings and route.
- `moon run cloudflare-build-config:sync-dry-run -- apps/ops-dashboard/workers-build.jsonc` is blocked in this environment because `CLOUDFLARE_API_TOKEN` is not set.
- Actual Cloudflare Access policy creation and Workers Builds publishing are blocked by missing Cloudflare credentials. Do not deploy publicly until the `ops.zeko.io` Access application is active.
