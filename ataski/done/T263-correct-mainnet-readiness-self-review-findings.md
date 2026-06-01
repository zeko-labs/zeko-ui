---
id: T263
title: "Correct mainnet readiness self-review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-22T12:12:00Z
updated_at: 2026-05-22T12:36:00Z
---

## Requirements

- Review the active PR branch against the written mainnet readiness plan and the user's review findings.
- Remove unjustified changes in `apps/bridge-ui/server/routes/tunnel.ts` unless a type/config constraint makes them necessary and documented.
- Remove generated/noisy comments or unused fields in `apps/bridge-ui/deploy-ci.nu`; keep the deploy script auditable and concise.
- Stop invoking `proto run` from Moon task definitions. Moon should call the Nushell entrypoint directly; Cloudflare Build may install and expose Nu through its own build/deploy command environment.
- Restore `testnet.bridge.zeko.io` as the primary Bridge UI testnet route and keep `alpha.bridge.zeko.io` as an alias in configs, docs, and allowed origins.
- Remove `BRANCH`/`SHA` template arguments from `northflank/actions-indexer/project.json`; use Northflank release-flow run overrides from GitHub Actions instead of template arguments for commit selection.
- Clean `services/actions/api/moon.yml`: default `deploy` must not silently deploy testnet, `deploy-preview` must not be `preset: server`, and added tasks must stay declarative rather than inline shell orchestration.
- Revert unrelated changes to `services/actions/indexer/moon.yml` and `services/actions/indexer/src/action-processing/runtime.ts`.
- Update the written plan and implementation log so it matches the corrected implementation.
- Validate with targeted static checks, Moon query/task checks, type generation where Wrangler config changes, and relevant tests.

## Test Plan

- BDD: assert that config and workflow behavior matches the plan. Use grep/static diff checks for forbidden patterns, `moon query tasks` for task definitions, `wrangler types` for Worker bindings after route/env changes, and focused lint/type/test commands for touched projects.

## RED Evidence

- `apps/bridge-ui/moon.yml` currently invokes `proto run nu --`.
- `apps/bridge-ui/wrangler.jsonc` currently omits `testnet.bridge.zeko.io`.
- `apps/bridge-ui/server/routes/tunnel.ts` differs from `origin/main` without plan justification.
- `northflank/actions-indexer/project.json` currently contains `BRANCH` and `SHA` arguments.
- `services/actions/api/moon.yml` currently has inline Docker test setup, `deploy` points at `--env testnet`, and `deploy-preview` has `preset: server`.
- `services/actions/indexer/moon.yml` and `services/actions/indexer/src/action-processing/runtime.ts` contain unrelated changes.

## GREEN Evidence

- Reverted `services/actions/indexer/moon.yml` and `services/actions/indexer/src/action-processing/runtime.ts` back to `origin/main`; `git diff --name-status origin/main -- services/actions/indexer/moon.yml services/actions/indexer/src/action-processing/runtime.ts` produced no output.
- Removed `proto run` from Bridge UI Moon tasks; `moon query tasks --project bridge-ui` shows deploy tasks invoke `command: nu` with `./deploy-ci.nu` and `runInCI: false`.
- Restored `testnet.bridge.zeko.io` as the primary testnet Bridge UI route while keeping `alpha.bridge.zeko.io` as alias in Wrangler config, metrics allowed origins, docs, Nuxt layer defaults, and Zeko skill references.
- Removed Northflank `BRANCH`/`SHA` template arguments; GitHub Actions and `scripts/mainnet-readiness/plan-northflank-mainnet.nu` use release-flow `overrides`.
- Cleaned `services/actions/api/moon.yml`; default deploy is `wrangler deploy`, testnet deploy is explicit, preview upload targets `--env testnet`, and new live e2e tasks use declarative `command`/`args`/`env`.
- Kept only the documented `server/routes/tunnel.ts` change: Sentry ingest host is derived from the configured public DSN so the PR does not add a new `SENTRY_HOST` binding.
- `rg -n "#|TODO|FIXME|Gemini|gemini" apps/bridge-ui/deploy-ci.nu` returns only the shebang.
- Forbidden-pattern scan for `proto run`, `run-proto`, Northflank `BRANCH`/`SHA` args, and old inline Docker test containers returns only the expected plan log text.
- `moon run bridge-ui:type-cf`, `bridge-ui:typecheck`, `bridge-ui:lint -f`, `bridge-ui:test-ci -f`, and `bridge-ui:build -f` passed.
- `moon run actions-api:typecheck -f`, `actions-indexer:typecheck -f`, `actions-indexer:lint -f`, `docs:test -f`, `zeko-skills:test -f`, `cloudflare-build-config:lint -f`, and `cloudflare-build-config:test -f` passed.
- After the pushed commit, GitHub CI exposed the missing docs skip for `https://testnet.bridge.zeko.io`; added the same post-review endpoint skip to `apps/docs/tests/check-links.test.ts`.
- `pnpm exec actionlint -ignore 'label "warp-ubuntu-latest-x64-8x" is unknown' .github/workflows/bridge-mainnet-release.yaml`, `jq empty northflank/actions-indexer/project.json`, `nu --version`, the Northflank dry-run script, `git diff --check`, and `moon run bridge-mainnet-readiness-plan:format -f` passed.
- `moon ci -f` did not resolve deploy tasks into the CI target set, but the full workspace run was blocked by local `ENOSPC` during unrelated faucet/leaderboard builds and initially caught plan/task formatting that has since been fixed.
