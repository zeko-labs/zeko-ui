---
id: T305
title: "Expose Sentry secrets to Cloudflare sync workflow"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T14:39:26Z
updated_at: 2026-06-10T14:39:26Z
---

## Requirements

- Fix the `apps/bridge-ui/workers-build.jsonc` sync failure caused by missing `SENTRY_AUTH_TOKEN` in the GitHub Actions workflow environment.
- Expose all `valueFromEnv` names used by checked-in Workers Build configs through the sync workflow.
- Add repo-level GitHub secrets for the Sentry values so workflow dispatches do not need deployment environment secrets.

## Test Plan

- DDD: use the failed `apps/bridge-ui` dispatch as RED evidence, validate workflow syntax locally, then rerun the bridge-ui sync workflow dispatch on `main`.

## RED Evidence

- GitHub Actions run `27283803871` failed while syncing `apps/bridge-ui/workers-build.jsonc` because `SENTRY_AUTH_TOKEN` was required.

## GREEN Evidence

- Added repo-level `SENTRY_AUTH_TOKEN` and `SENTRY_DSN_PUBLIC` GitHub secrets from local operator environment values.
- `actionlint -ignore 'label "warp-ubuntu-latest-x64-2x" is unknown' .github/workflows/sync-cloudflare-build-config.yaml`: passed.
- `CI=true moon exec --ignore-ci-checks cloudflare-build-config:sync-dry-run -- apps/bridge-ui/workers-build.jsonc`: passed with Cloudflare and Sentry env vars mapped from local operator environment values.
