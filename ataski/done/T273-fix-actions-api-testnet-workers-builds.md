---
id: T273
title: "Fix Actions API testnet Workers Builds"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-27T06:13:05Z
updated_at: 2026-05-27T06:56:25Z
---

## Requirements

- Ensure Cloudflare Workers Builds for Actions API deploy `main` pushes to the testnet Worker script, not the mainnet Worker script.
- Keep the deploy command on `main` pointed at `actions-api:deploy-testnet`.
- Keep non-production branch previews on the testnet Worker script.
- Preserve mainnet deployment as manual/release workflow driven, not automatic on every `main` push.
- Validate the checked-in Workers Build source of truth and the remote Cloudflare trigger state.
- Commit and push the fix branch.

## Test Plan

- DDD: the RED evidence is Cloudflare remote state showing the Actions API default-branch trigger attached to `actions-api` with `actions-api:deploy`, while `actions-api-testnet` has no build triggers.
- GREEN path: update `services/actions/api/workers-build.jsonc` to target `actions-api-testnet`, publish/sync remote Workers Builds so the testnet script has the expected triggers, disable the stale automatic triggers on `actions-api`, and verify the remote state.

## RED Evidence

- Cloudflare API returned existing `actions-api` Workers Builds triggers:
  - `Deploy default branch`: `./node_modules/.bin/moon exec --ignore-ci-checks actions-api:deploy`
  - `Deploy non-production branches`: `./node_modules/.bin/moon exec --ignore-ci-checks actions-api:deploy-preview`
- Cloudflare API returned no Workers Builds triggers for `actions-api-testnet`.

## GREEN Evidence

- Updated `services/actions/api/workers-build.jsonc` to target `actions-api-testnet` and use `actions-api` only as the trigger creation template.
- Added checked-in disabled trigger config for the stale `actions-api` automatic Workers Builds.
- Updated `actions-api:publish-cf-build-config` to sync both the active testnet config and disabled mainnet config.
- Enhanced `cloudflare-build-config:sync` to create missing triggers when `triggerTemplateScriptName` is set.
- `moon run cloudflare-build-config:sync-dry-run -- services/actions/api/workers-build.jsonc services/actions/api/workers-build-mainnet-disabled.jsonc`: all four remote triggers already match checked-in config after publish.
- `moon run actions-api:publish-cf-build-config`: created the missing `actions-api-testnet` triggers and disabled the stale automatic `actions-api` triggers.
- Read-only Cloudflare verification:
  - `actions-api-testnet` `Deploy default branch` runs `./node_modules/.bin/moon exec --ignore-ci-checks actions-api:deploy-testnet` on `main`.
  - `actions-api-testnet` non-production branches run `./node_modules/.bin/moon exec --ignore-ci-checks actions-api:deploy-preview`.
  - `actions-api` automatic triggers now point at impossible `__disabled__` path/branch patterns.
- `moon run cloudflare-build-config:typecheck cloudflare-build-config:lint -f`: passed.
- `moon run zeko-ui:format-all -f`: passed.
