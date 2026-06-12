---
id: T341
title: "Rename actions dashboard and clean board"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-13T00:00:00Z
updated_at: 2026-06-13T02:22:00Z
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
- `moon run -f actions-dashboard:configure-access` created the GitHub-backed Cloudflare Access app for `actions.dashboard.zeko.io`.
- `moon run -f actions-dashboard:deploy` deployed Worker version `331e2672-0b1b-4239-8cd2-757b6c1297e3` to `actions.dashboard.zeko.io`.
- Ataski dashboard task history was squashed into T311 and no stale in-progress task remains.

## Remaining External State

- `actions-dashboard` is a new Cloudflare Worker script and does not inherit the old `ops-dashboard` secret values. `wrangler secret list` currently returns no secrets for `actions-dashboard`; set `MAINNET_ACTIONS_INDEXER_TOKEN` and `TESTNET_ACTIONS_INDEXER_TOKEN` before relying on authenticated indexer probes or controls.
- `actions.dashboard.zeko.io` currently returns a TLS handshake failure. This hostname is a second-level subdomain and needs Cloudflare edge certificate coverage, for example Advanced Certificate Manager or Total TLS, before Access can serve it.
- `actions-dashboard:publish-cf-build-config` is blocked because the available `CFZT_TOKEN` can configure Access but is rejected by the Workers Builds API. A Cloudflare API token with the Workers Builds permissions is needed to publish the renamed trigger config.
