---
id: T259
title: "Fix worker preview CI without disabling"
status: done
blockedBy: [T258]
owner: codex
created_at: 2026-05-21T15:31:51Z
updated_at: 2026-05-22T09:47:26Z
---

## Requirements

- Correct the previous CI fix so `deploy-preview` remains a real preview deployment path.
- Fix the branch-preview entrypoints invoked by existing Cloudflare Workers Build checks:
  - `moon exec --ignore-ci-checks actions-api:deploy-preview`
  - `moon exec --ignore-ci-checks bridge-ui:deploy-preview`
- Do not deploy live traffic locally while validating.
- Preserve the reviewed deployment invariant: `main` deploys testnet, the unified GitHub Actions workflow deploys mainnet, and PR branch preview tasks must not route traffic to mainnet.
- Update the implementation review log to explicitly record the correction from the prior no-op change.

## Test Plan

- DDD: inspect existing Cloudflare Workers Build commands, `wrangler.jsonc` environments, and Moon tasks to identify why preview tasks were failing.
- GREEN validation:
  - static checks for the restored deploy-preview commands
  - targeted Moon lint/typecheck/test commands for affected projects
  - PR check rollup after push

## RED Evidence

- The prior `fix(bridge): resolve pr ci failures` commit changed `deploy-preview` tasks to `echo` commands, which bypassed the worker preview deployment path instead of fixing it.

## GREEN Evidence

- Restored real branch preview commands instead of `echo` no-ops:
  - `apps/bridge-ui:deploy-preview` runs the real Bridge UI preview deploy path. T260 later routed the task through `scripts/run-proto-nu.sh` so Cloudflare Builds can bootstrap proto before running `deploy-ci.nu`.
  - `services/actions/api:deploy-preview` runs `wrangler versions upload --env testnet`.
- Pointed Bridge UI preview uploads at the `testnet` Wrangler env so preview uploads do not use mainnet routes/placeholders.
- Added `version_metadata` to `apps/bridge-ui/wrangler.jsonc` `env.testnet` because Wrangler does not inherit that binding from the top-level config.
- Added upstream build dependencies to `actions-indexer:test` so fresh CI builds `@zeko-labs/bridge-sdk` before tests import it.
- Local validation passed:
  - `moon run -f actions-indexer:test`
  - `moon run actions-indexer:typecheck actions-indexer:lint actions-api:typecheck bridge-ui:typecheck`
  - `moon run bridge-ui:build`
  - `pnpm exec wrangler versions upload --env testnet --dry-run` in `services/actions/api`
  - `pnpm exec wrangler versions upload --env testnet --dry-run` in `apps/bridge-ui`
  - `git diff --check`
- Expected remaining CI blocker:
  - `CI=1 moon run -f docs:test` fails only because `https://testnet.bridge.zeko.io` is not deployed yet.
  - This PR needs review before the next infra/deploy step; once the testnet Bridge route is deployed, rerun CI to unblock the docs external-link check.
