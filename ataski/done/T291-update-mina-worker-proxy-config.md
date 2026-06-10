---
id: T291
title: "update-mina-worker-proxy-config"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-09T00:00:00Z
updated_at: 2026-06-09T00:00:00Z
---

## Requirements

- Update the four Mina proxy Worker entrypoints to use the new `createProxyHandler({ primaryUrl, backupUrls, options })` API.
- Files:
  - `services/mina-archive-proxy-devnet/worker.ts`
  - `services/mina-archive-proxy-mainnet/worker.ts`
  - `services/mina-proxy-devnet/worker.ts`
  - `services/mina-proxy-mainnet/worker.ts`
- Replace each `hostnames` variable with a single `primaryUrl` string using the current configured URL.
- Add `backupUrls` as an empty list for now so operators can fill it later.
- Preserve existing CORS settings.
- Do not change Cloudflare routes, wrangler config, or generated type files.

## Test Plan

- Test strategy: BDD for the Worker configuration contract: each Worker should compile against the new proxy handler API while preserving its existing primary backend and CORS behavior.
- RED path: current Worker files still call the removed `hostnames` API, so a build/type validation would fail once checked against the new handler API. Record this as the pre-edit RED evidence because the API removal has already been applied.
- GREEN path: run the smallest meaningful validation available through Moon from the repository root after changing the four Worker files.

## RED Evidence

- 2026-06-09: The four Worker files still used `createProxyHandler({ hostnames, ... })` after legacy `hostnames` support was removed from `@zeko/proxy-handler`; this is the expected compile/API mismatch before this task's source edits.

## GREEN Evidence

- 2026-06-09: `./node_modules/.bin/tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --lib ES2022,WebWorker --skipLibCheck services/mina-archive-proxy-devnet/worker.ts services/mina-archive-proxy-mainnet/worker.ts services/mina-proxy-devnet/worker.ts services/mina-proxy-mainnet/worker.ts` passed.
- 2026-06-09: `grep hostnames services --glob worker.ts` returned 0 matches.
