---
id: T260
title: "Bootstrap proto for Bridge Workers Build"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-22T09:56:05Z
updated_at: 2026-05-22T10:10:18Z
---

## Requirements

- Keep Bridge UI Cloudflare Workers Build preview deploys real; do not replace deploy work with no-op commands.
- Make the checked-in Workers Build configuration explicit about the proto toolchain needed by `bridge-ui:deploy-testnet` and `bridge-ui:deploy-preview`.
- Preserve the Nushell deploy entrypoint and `proto-nu` flow requested for deployment scripts.
- Avoid live local deploys. Validation must use local build/typecheck/dry-run commands and remote PR check status.
- Record this follow-up in the written review log because it is an implementation detail discovered while fixing CI, not an original plan item.

## Test Plan

- Test Strategy Exception: Cloudflare Workers Builds runs in Cloudflare-managed infrastructure and this repo does not provide a local runner for trigger `buildCommand`/`deployCommand` sequencing. A test-first automated harness is not available for this remote CI integration.
- Validate by checking the config shape, running the relevant local Bridge build/typecheck, and running Wrangler dry-run uploads without deploying.

## RED Evidence

- Remote PR check `Workers Builds: bridge` fails immediately on commit `4f25221`, while local `bridge-ui:build` and `wrangler versions upload --env testnet --dry-run` pass.
- Cloudflare Workers Builds documentation lists Node, pnpm, curl, and related build tools as preinstalled, but not proto; this branch's Bridge deploy tasks need proto to run the Nushell entrypoint.

## GREEN Evidence

- Added `scripts/run-proto-nu.sh` as the reviewable bootstrap used by Bridge deploy Moon tasks. It installs pinned proto when absent, installs pinned Node/pnpm/Nushell through proto, then runs `proto run nu --`.
- Updated `apps/bridge-ui/moon.yml` so `deploy`, `deploy-testnet`, `deploy-mainnet`, and `deploy-preview` all call `../../scripts/run-proto-nu.sh ./deploy-ci.nu`.
- Updated `apps/bridge-ui/workers-build.jsonc` so the checked-in Cloudflare trigger source of truth uses `./scripts/run-proto-nu.sh --version` as its build command.
- `tmp_home=$(mktemp -d); HOME="$tmp_home" PROTO_HOME="$tmp_home/.proto" PATH="/usr/bin:/bin:/usr/sbin:/sbin" ./scripts/run-proto-nu.sh --version` installed proto, Node, pnpm, and Nushell into the temporary proto home and printed `0.112.2`.
- `moon query tasks 'project = bridge-ui' | rg 'deploy(-testnet|-mainnet|-preview)?|run-proto-nu|deploy-ci'` showed all Bridge deploy tasks using `../../scripts/run-proto-nu.sh ./deploy-ci.nu`.
- `WORKERS_CI_BRANCH=branch/bridge-mainnet-readiness-plan WORKERS_CI_COMMIT_SHA=4f25221eb42c2cc40912ab680280164bb04de846 moon exec --ignore-ci-checks bridge-ui:deploy-preview` reached the Nu deploy entrypoint and failed fast on missing `SENTRY_ORG` before any build or deploy work.
- `moon run :format-all-fix` passed.
- `node -e "JSON.parse(require('fs').readFileSync('apps/bridge-ui/workers-build.jsonc','utf8')); console.log('valid workers-build json')"` passed.
- `moon run cloudflare-build-config:typecheck bridge-ui:typecheck` passed.
- `pnpm exec wrangler versions upload --env testnet --dry-run` from `apps/bridge-ui` passed with the expected existing bundling warnings and testnet bindings.
- `git diff --check` passed.
