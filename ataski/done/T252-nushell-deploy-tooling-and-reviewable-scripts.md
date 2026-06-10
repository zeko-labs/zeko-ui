---
id: T252
title: "Nushell deploy tooling and reviewable scripts"
status: done
blockedBy: [T251]
owner: codex
created_at: 2026-05-21T10:40:00Z
updated_at: 2026-05-21T11:08:00Z
---

## Requirements

- Add `proto-nu` to `.prototools` and pin Nushell for repo workflows.
- Rewrite Bridge UI deploy logic from `apps/bridge-ui/deploy-ci.sh` to a Nushell entrypoint invoked through `proto run nu --`.
- Support explicit Bridge UI deploy targets: `testnet`, `mainnet`, and `preview`.
- Use Sentry environment `testnet` for testnet, `mainnet` for mainnet, and branch-hashed preview environments for preview.
- Preserve Sentry release creation, commit association, sourcemap injection/upload, deploy event creation, release finalization, and Cloudflare deploy/upload behavior.
- Add temporary mainnet-readiness scripts under `scripts/mainnet-readiness/` using Nushell through `proto-nu`; do not add shell scripts for these helpers.
- Temporary scripts must default to dry-run/plan output, print exact planned Cloudflare, Supabase, Northflank, and GitHub operations, avoid concrete secrets, and require an explicit `--execute` or equivalent flag for mutations.
- Update `docs/BRIDGE_MAINNET_READINESS_PLAN.md` Implementation Review Log for any implementation details not already specified.

## Test Plan

- TDD: first run the existing Bridge UI deploy script/task inspection to show it still infers behavior from `WORKERS_CI_BRANCH` and there is no Nushell tooling or mainnet-readiness script.
- GREEN validation:
  - `proto install`
  - `proto run nu -- --version`
  - dry-run each new Nushell helper without secrets.
  - run syntax/parse checks for each Nushell script.
  - run relevant Bridge UI Moon task checks without performing live deploys.

## RED Evidence

Recorded on 2026-05-21:

- `.prototools` contains moon/node/npm/pnpm/bun/rust/proto only; no `nu` tool or `proto-nu` plugin is configured.
- `apps/bridge-ui/deploy-ci.sh` is a Bash script that derives production behavior from `WORKERS_CI_BRANCH=main`, sets `SENTRY_ENVIRONMENT=production`, and runs plain `wrangler deploy` on `main`.
- `find scripts/mainnet-readiness -maxdepth 2 -type f` returned no files, so there are no reviewable dry-run-first mainnet-readiness Nushell helpers.
- `ataski/tasks.md` shows `T251` done, so `T252` is unblocked.

## GREEN Evidence

Recorded on 2026-05-21:

- `proto install nu && proto run nu -- --version` installed/confirmed Nushell `0.112.2`.
- `proto run nu -- --commands 'source apps/bridge-ui/deploy-ci.nu; print deploy-ci-loaded'` returned `deploy-ci-loaded`.
- `BRIDGE_UI_DEPLOY_TARGET=testnet proto run nu -- apps/bridge-ui/deploy-ci.nu` failed fast with `Missing required environment variable WORKERS_CI_COMMIT_SHA` before any build or deploy command ran.
- `proto run nu -- scripts/mainnet-readiness/provision-actions-mainnet.nu`, `plan-northflank-mainnet.nu`, and `plan-github-mainnet-secrets.nu` all ran in dry-run mode.
- `moon query tasks 'project = bridge-ui' | rg 'deploy(-testnet|-mainnet|-preview)?'` showed `deploy`, `deploy-testnet`, `deploy-mainnet`, and `deploy-preview` invoking `proto run nu -- ./deploy-ci.nu`.
- `rg -n "deploy-ci\\.sh|<exact mainnet|TODO during implementation|hash sha1|production\\\"" .prototools apps/bridge-ui scripts/mainnet-readiness docs/BRIDGE_MAINNET_READINESS_PLAN.md` found no stale implementation references outside historical plan text and unrelated app debug code.
