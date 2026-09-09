---
id: T497
title: "Configure Actions Dashboard for Sepolia"
status: done
blockedBy: []
owner: codex
created_at: 2026-09-09T00:00:00Z
updated_at: 2026-09-09T09:00:00Z
---
## Requirements

- Add Sepolia as a first-class Actions Dashboard network at `apps/actions-dashboard`.
- Make Sepolia the default network when the dashboard URL has no valid `network` query parameter, while preserving explicit mainnet and testnet selection.
- Configure Sepolia-only Actions API, indexer, archive, daemon, public action key, and indexer-token environment names:
  - Actions API: `https://sepolia.api.actions.zeko.io/graphql`
  - Actions indexer: `https://sepolia.indexer.actions.zeko.io`
  - L1 archive: `https://sepolia-gateway.zeko.io/graphql`
  - L2 archive: `https://archive.sepolia.zeko.io/graphql`
  - L2 daemon: `https://sepolia.zeko.io/graphql`
  - L1 daemon: explicitly unsupported unless supplied as a Sepolia-specific override; never use testnet.
  - Outer action key: `B62qpggUSofPZcWqtgbmLVnSAzzjAqSXjyckLJaBeGmXiPnc2mGUfhf`
  - Inner action key: `B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`
- Keep mainnet/testnet defaults and controls unchanged; keep all indexer tokens server-side.
- Update dashboard deployment variables, local environment documentation, and operator documentation for Sepolia.
- Do not deploy or mutate Cloudflare/Northflank resources in this task.

## Test Plan

- Strategy: BDD.
- RED: extend the dashboard utility tests with Sepolia selection, endpoint isolation, token selection, and explicit unsupported-L1-daemon assertions; run them before implementation and record the expected failures.
- GREEN: implement the network configuration and dashboard selector/default, then run the focused dashboard tests, typecheck, lint, and build.

## RED Evidence

- Baseline `moon run actions-dashboard:test -f` passed before the Sepolia assertions were added; the current suite had no Sepolia coverage.
- RED `node_modules/.bin/moon run actions-dashboard:test -f` after adding the BDD assertions failed 4 tests: Sepolia network resolution/control, Sepolia endpoint defaults, and explicit unsupported L1 daemon handling.

## GREEN Evidence

- `node_modules/.bin/moon run actions-dashboard:test -f` passed: 39 tests.
- `node_modules/.bin/moon run actions-dashboard:lint -f` passed.
- `cd apps/actions-dashboard && ./node_modules/.bin/wrangler deploy --dry-run --config wrangler.jsonc` passed and listed the Sepolia API, indexer, archive, L2 daemon, and public-key bindings without changing mainnet/testnet bindings.
- `git diff --check` passed.
- Live read-only checks passed for Sepolia API/indexer health, L1/L2 archive reachability, and the Sepolia L2 daemon. The Sepolia L1 daemon endpoint is intentionally reported as unsupported.
- `node_modules/.bin/moon run actions-dashboard:typecheck -f` remains blocked by pre-existing missing `node:path` and `node:url` declarations in `nuxt.config.ts`; no dashboard Sepolia type errors remain.
- Build was not completed because the Moon build is gated by that typecheck failure; no deployment was attempted.
