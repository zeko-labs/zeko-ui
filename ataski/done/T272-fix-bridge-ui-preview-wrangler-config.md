---
id: T272
title: "Fix Bridge UI preview Wrangler config"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-27T05:48:41Z
updated_at: 2026-05-27T05:54:39Z
---

## Requirements

- Fix the PR Workers Builds failure for `bridge-ui:deploy-preview`.
- Preserve the existing production/testnet deploy targets and route separation.
- Do not edit `apps/bridge-ui/worker-configuration.d.ts` manually.
- Commit and push the PR branch after validation.

## Test Plan

- DDD: the RED evidence is the CI deploy log from PR #183 where Wrangler rejects `.output/server/wrangler.json` because redirected generated configurations cannot include `env.testnet`.
- GREEN path: reproduce or inspect the generated config path locally, update the deploy script/config handling, then run focused build/deploy validation that confirms preview upload no longer passes an invalid env on a redirected generated config.

## RED Evidence

- PR CI failed in `bridge-ui:deploy-preview` with: `Redirected configurations cannot include environments ... testnet` while processing `.output/server/wrangler.json`.

## GREEN Evidence

- Reproduced Wrangler's redirected-config behavior in a temporary project: without explicit `--config`, `wrangler versions upload --env testnet --dry-run` failed with the same `Redirected configurations cannot include environments` error; with `--config wrangler.jsonc`, the dry-run succeeded.
- `cd apps/bridge-ui && pnpm exec wrangler versions upload --config wrangler.jsonc --env testnet --dry-run`: completed successfully and reported the expected testnet bindings.
- `nu -n -c 'source apps/bridge-ui/deploy-ci.nu; ...'`: confirmed preview, testnet, and mainnet target configs include explicit `--config wrangler.jsonc`.
- `moon run bridge-ui:build -f`: completed successfully.
- `moon run bridge-mainnet-readiness-plan:format-all -f`: completed successfully.
- `moon run bridge-ui:typecheck -f`: completed successfully.
