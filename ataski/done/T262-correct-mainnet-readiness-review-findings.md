---
id: T262
title: "Correct mainnet readiness review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-22T10:43:12Z
updated_at: 2026-05-22T11:09:05Z
---

## Requirements

- Add the missing unified `mainnet` GitHub Actions release workflow for Actions DB migrations, Actions API mainnet deploy, Northflank mainnet indexer release trigger, health validation, Bridge UI mainnet deploy, and Bridge URL smoke checks.
- Remove the standalone testnet Actions API deploy workflow; testnet Actions API deployment must stay owned by Cloudflare Build.
- Restore Actions API Cloudflare Build commands so the default branch deploys the testnet Wrangler environment and PR branches upload testnet-env preview versions.
- Remove `scripts/run-proto-nu.sh` and stop routing normal Bridge UI Moon deploy tasks through it. Keep Moon deploy tasks directly invoking `proto run nu -- ./deploy-ci.nu`.
- Keep Cloudflare Workers Build Nu/proto setup in `apps/bridge-ui/workers-build.jsonc`, not in reusable Moon task commands.
- Remove the unreviewed `SENTRY_HOST` Wrangler placeholder changes unless an existing typed binding requires them.
- Replace broad `REVIEW_REQUIRED_ACTIONS_MAINNET_DB_*` placeholders with a single grep-friendly placeholder prefix that cannot be confused with real IDs.
- Make the mainnet-readiness Nushell scripts print concrete commands that can be reviewed, with env vars only for secrets and resource IDs that genuinely do not exist before review.
- Revisit the Northflank template changes and align them with the existing working template model instead of hardcoding secret-like runtime values.
- Restore `actions-indexer:test` to run all tests unless a failing test exposes a real issue that is fixed in this branch.
- Update the plan/review log to describe these corrections and remove superseded bad decisions.

## Test Plan

- BDD: workflow/config behavior must match the review requirements. Validate with static inspection of workflow commands, Moon task queries, config grep checks, and relevant automated test commands.
- RED evidence is the current branch state: missing mainnet release workflow, extra testnet deploy workflow, disabled Actions API Cloudflare Build, Bridge deploy Moon tasks polluted with `scripts/run-proto-nu.sh`, Sentry placeholder vars, broad placeholders, excluded indexer tests, and placeholder-only scripts.

## RED Evidence

- `ls .github/workflows/bridge-mainnet-release.yaml` fails because the unified mainnet workflow is absent.
- `.github/workflows/actions-api-testnet.yaml` exists even though testnet deploys should remain under Cloudflare Build.
- `services/actions/api/workers-build.jsonc` contains `echo` deploy commands.
- `apps/bridge-ui/moon.yml` deploy tasks call `../../scripts/run-proto-nu.sh`.
- `apps/bridge-ui/wrangler.jsonc` contains `REVIEW_REQUIRED_SENTRY_HOST`.
- `services/actions/indexer/moon.yml` excludes three tests from `actions-indexer:test`.
- Mainnet readiness scripts print placeholder commands rather than concrete reviewable command lines.

## GREEN Evidence

- Added `.github/workflows/bridge-mainnet-release.yaml` as the single `mainnet` environment-gated release workflow for mainnet DB migrations, Actions API deploy, Northflank mainnet release-flow trigger, health validation, Bridge UI deploy, and `https://bridge.zeko.io` smoke check.
- Deleted `.github/workflows/actions-api-testnet.yaml`; testnet deployment remains owned by Cloudflare Build and Northflank automation.
- Restored `services/actions/api/workers-build.jsonc` so `main` deploys `actions-api:deploy-testnet` and non-main branches deploy previews instead of disabling deploy commands.
- Removed `scripts/run-proto-nu.sh`; Bridge UI Moon deploy tasks now call `proto run nu -- ./deploy-ci.nu` directly.
- Kept Cloudflare Build Nu/proto setup in `apps/bridge-ui/workers-build.jsonc` and verified a clean temporary HOME can install proto 0.55.3 plus Nushell 0.112.2 and run `proto run nu --version`.
- Removed the unreviewed `SENTRY_HOST` Wrangler vars and derived the Sentry tunnel host from the existing public DSN runtime config.
- Replaced broad mainnet Hyperdrive placeholders with `__MAINNET_REVIEW_REQUIRED_HYPERDRIVE_*__`.
- Rewrote the mainnet-readiness Nushell scripts so dry runs print exact `gh`, `supabase`, `wrangler hyperdrive`, and Northflank `curl` commands, with `--execute` required for mutations.
- Cleaned Northflank mainnet env values to use template/release arguments instead of hardcoded mainnet URLs/keys in runtime env values.
- Restored `actions-indexer:test` to run the full Vitest suite and made its Moon task provision the required local Postgres test database.
- Updated `docs/BRIDGE_MAINNET_READINESS_PLAN.md` review log and ownership sections so the plan no longer describes a standalone GitHub Actions testnet deploy.
- `rg` stale-reference check passes except intentional review-log mentions of removed `SENTRY_HOST` and `scripts/run-proto-nu.sh`.
- `moon run bridge-ui:type-cf` passed.
- `moon run actions-api:type-cf` passed.
- `proto run nu -- scripts/mainnet-readiness/plan-github-mainnet-secrets.nu` dry-run passed with `GITHUB_REPOSITORY=zeko-labs/zeko-ui`.
- `proto run nu -- scripts/mainnet-readiness/plan-northflank-mainnet.nu` dry-run passed with dummy Northflank env.
- `proto run nu -- scripts/mainnet-readiness/provision-actions-mainnet.nu` dry-run passed with dummy Supabase/DB env.
- `moon run docs:test -f` passed.
- `moon run bridge-ui:typecheck` passed.
- `moon run bridge-ui:test-ci -f` passed.
- `moon run bridge-ui:build -f` passed.
- `moon run bridge-ui:lint -f` passed.
- `moon run actions-indexer:test -f` passed with the restored full suite.
- `moon run actions-indexer:typecheck -f` passed.
- `moon run actions-indexer:lint -f` passed.
- `moon run actions-api:test -f` passed.
- `moon run actions-api:typecheck -f` passed.
- `moon run actions-api:lint -f` passed.
- `pnpm exec actionlint -ignore 'label "warp-ubuntu-latest-x64-8x" is unknown' .github/workflows/bridge-mainnet-release.yaml` passed.
- `moon run cloudflare-build-config:lint -f` passed.
- `moon run cloudflare-build-config:test -f` passed as a no-op.
- `moon run cloudflare-build-config:sync-dry-run` is credential-bound: without env it requires `CLOUDFLARE_API_TOKEN`; with dummy env Cloudflare rejects the account id, so it cannot be meaningfully completed in this local environment.
- `moon ci` passed locally after the focused uncached validations.
