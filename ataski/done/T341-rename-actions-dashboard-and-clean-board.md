---
id: T341
title: "Rename actions dashboard and clean board"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-13T00:00:00Z
updated_at: 2026-06-13T02:33:00Z
---

## Requirements

- Rename the dashboard project from ops-dashboard to actions-dashboard in project metadata, commands, docs, tests, and Cloudflare Worker configuration.
- Move the production hostname from ops.zeko.io to actions.dashboard.zeko.io.
- Keep Cloudflare Access configuration programmatic for the new hostname.
- Clear stale in-progress Ataski state and squash prior dashboard micro-tasks into one concise task record.
- Preserve existing dashboard behavior and server-side token handling.

## Test Plan

- BDD: update existing dashboard tests to assert the new actions-dashboard hostname/name and Worker settings.
- RED path: confirm the repo still contains old ops-dashboard identifiers before implementation.
- GREEN path: update project naming/configuration/docs, run dashboard test/typecheck/lint/build, configure Access, deploy, and verify the new hostname state.

## RED Evidence

- `rg` before the rename found old `ops-dashboard`, `ops.zeko.io`, and `OPS_DASHBOARD` references in the app, tests, docs, Worker config, Workers Builds config, and package metadata.

## GREEN Evidence

- `rg` after the rename found no old `ops-dashboard`, `ops.zeko.io`, or old display-name references outside deliberate backward-compatible `OPS_DASHBOARD_*` aliases.
- `moon run -f actions-dashboard:test` passed: 27 tests.
- `moon run -f actions-dashboard:typecheck actions-dashboard:lint actions-dashboard:build && git diff origin/main --check` passed.
- `moon run -f actions-dashboard:configure-access` created the Cloudflare Access app for `actions.dashboard.zeko.io`.
- `moon run -f actions-dashboard:deploy` deployed Worker version `331e2672-0b1b-4239-8cd2-757b6c1297e3` to `actions.dashboard.zeko.io`.
- `MAINNET_ACTIONS_INDEXER_TOKEN` and `TESTNET_ACTIONS_INDEXER_TOKEN` were copied from the matching Northflank indexer service `AUTH_TOKEN` runtime variables into the `actions-dashboard` Worker secrets.
- `moon run -f actions-dashboard:publish-cf-build-config` created the Cloudflare Workers Builds default-branch and non-production branch triggers for the renamed Worker.
- `curl -I https://actions.dashboard.zeko.io` returns the expected Cloudflare Access redirect for the protected dashboard hostname.
- Ataski dashboard task history was squashed into T326 and no stale in-progress task remains.

## External State

- The dashboard is deployed at `https://actions.dashboard.zeko.io` behind Cloudflare Access.
- The new Worker has the required mainnet and testnet action-indexer tokens.
- Cloudflare Workers Builds is configured for the renamed Worker and should survive future CI redeploys.
