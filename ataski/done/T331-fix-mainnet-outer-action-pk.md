---
id: T331
title: "Fix mainnet outer action PK"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T10:14:53Z
updated_at: 2026-06-12T10:22:19Z
---

## Requirements

- Replace stale mainnet outer action public key references in the repo with the live Zeko mainnet `circuitsConfig.zekoL1` value.
- Update the live Northflank mainnet actions-indexer deployment runtime env so future restarts/redeploys use the correct `OUTER_PK`.
- Restart the Northflank mainnet actions-indexer service so the process reads the corrected runtime env.
- Do not reset or rebuild the indexer database; the user will run reset.
- Redeploy the ops dashboard so its mainnet checks use the corrected outer action public key.

## Test Plan

- DDD: verify stale key occurrences before editing and verify none remain after editing.
- Validate the dashboard package with targeted test, typecheck, lint, and build tasks.
- Verify Northflank runtime env reports the corrected `OUTER_PK` after patch/restart.
- Verify the dashboard deploy completes and Cloudflare Access still protects `ops.zeko.io`.

## RED Evidence

- `rg` found the stale mainnet outer action public key in dashboard defaults, dashboard Wrangler vars, readiness docs/scripts, tests, and historical Ataski notes.

## GREEN Evidence

- A final `rg` scan for the stale mainnet outer action public key returned no matches after the repo update.
- `moon run -f ops-dashboard:test` passed: 14 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed.
- Northflank mainnet `actions-indexer-mainnet-deployment` runtime env was patched and verified with `OUTER_PK=B62qm46jqHb9HAYiyGJeYkWgqNtPQEiTcssuoiua8VvKJGDStFsRcyC`, `INNER_PK=B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`, `L1_ARCHIVE_URL=https://api.minascan.io/archive/mainnet/v1/graphql`, `L2_ARCHIVE_URL=https://archive.mainnet.zeko.io/graphql`, and `ENVIRONMENT=mainnet`.
- Restarted Northflank mainnet service `actions-indexer-mainnet-deployment`; `https://indexer.actions.zeko.io/health` returned `service=mainnet`, `indexerStatus=running`, and `lastFetchedBlock.outer=527826`.
- Did not run indexer reset, rebuild, or resync.
- `moon run -f ops-dashboard:deploy` passed and deployed `ops-dashboard` version `711548de-232d-4f84-8d76-9c030baf521d` to `ops.zeko.io`.
- `curl -I https://ops.zeko.io` and `curl -I 'https://ops.zeko.io/api/ops/status?network=mainnet'` both returned Cloudflare Access `302` redirects.
