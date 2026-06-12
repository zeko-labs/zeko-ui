---
id: T344
title: "Investigate dashboard indexer routing"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T22:36:16Z
updated_at: 2026-06-12T22:48:43Z
---

## Requirements

- Determine why server-side requests from the actions dashboard Worker to the public action-indexer host loop with a same-URL redirect after the dashboard hostname rename.
- Verify whether the dashboard should call public indexer URLs or a separate origin URL, and avoid hardcoded Northflank service DNS unless the platform configuration requires it and the reason is documented in code/tests.
- Investigate why mainnet L2 coverage reports `indexer fetched -` while the archive has a head, and distinguish a dashboard parser bug from real action-indexer state.
- Keep user-facing status accurate: do not report false errors, but do surface a missing mainnet inner fetched height if the indexer really reports `null`.

## Test Plan

- BDD: reproduce the redirect behavior from a Worker-like environment or Cloudflare configuration query before changing runtime behavior.
- BDD: add or update dashboard utility tests for the chosen indexer request URL behavior and for an indexer health payload where `lastFetchedBlock.inner` is `null`.

## RED Evidence

- `curl --max-redirs 0 https://indexer.actions.zeko.io/health` returns HTTP 200 from outside Cloudflare and reports mainnet `indexer.lastFetchedBlock.inner: null`.
- `curl --max-redirs 0 https://testnet.indexer.actions.zeko.io/health` returns HTTP 200 from outside Cloudflare and reports testnet `indexer.lastFetchedBlock.inner: 1095899`.
- Cloudflare DNS API reports `indexer.actions.zeko.io` and `testnet.indexer.actions.zeko.io` are unproxied CNAME records pointing at Northflank DNS.
- A temporary custom-domain Worker on `actions-debug.zeko.io` reproduced the failure: `fetch("https://indexer.actions.zeko.io/health", { redirect: "manual" })` returned HTTP 301 with `Location: https://indexer.actions.zeko.io/health`, while the same Worker code on `workers.dev` returned HTTP 200.
- Mainnet Northflank runtime logs show repeated inner failures after the L2 archive returns 3 raw action blocks: `runIndexingLoop inner error: action-processing process exited with code 1`.
- Local processing of the mainnet L2 archive payload reproduces the real error: `invalid actions chain at index=2: prev.afterActionState=7457586723480041688339908437490441639851877885898337495605417291861840577257 != curr.beforeActionState=25079927036070901246064867767436987657692091363973573142121686150614948079097`.

## GREEN Evidence

- Removed hardcoded Northflank origin defaults from dashboard application code; production origin routing now comes only from explicit Cloudflare Worker vars.
- Updated the dashboard to display a missing indexer fetched height as an error with `indexing has not completed a successful run` instead of vague coverage text.
- Updated the action-processing runtime to surface structured worker errors from stdout when the worker process exits non-zero.
- Deleted the temporary debug Worker, deleted the temporary DNS record, and removed local debug files.
- `moon run -f actions-dashboard:test actions-dashboard:typecheck actions-dashboard:lint actions-dashboard:build` passed.
- `moon run -f actions-indexer:typecheck actions-indexer:lint actions-indexer:build` passed.
- `pnpm --filter @zeko/actions-indexer exec vitest run test/action-processing.runtime.test.ts` passed.
- `moon run -f actions-dashboard:deploy` deployed Worker version `a98a37b3-a1e6-4e6e-a879-cc9e4ba58e2b`.
