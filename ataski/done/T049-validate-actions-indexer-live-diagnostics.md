---
id: T049
title: "Validate actions-indexer live diagnostics commands"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-09T13:05:35Z
updated_at: 2026-03-09T13:27:43Z
---

## Scope

Validate that the services/actions/indexer diagnostics commands actually work against the live endpoint and its real supporting services, then fix any breakages discovered.

## TDD Exception

This task starts with live endpoint verification across deployed services and external tooling. A RED unit test cannot establish whether the production-facing diagnostics commands work against the real endpoint and Northflank environment.

Validation strategy:

1. Run the diagnostics CLI commands against https://indexer.actions.zeko.io.
2. Verify which commands succeed with real inputs and credentials.
3. If a command fails, reproduce locally, fix the implementation, and then rerun the live command.

## GREEN Evidence

```bash
moon run actions-indexer:typecheck -f
moon run actions-indexer:lint -f
moon run actions-indexer:test-service-integration -f
moon run actions-indexer:diagnose-health -- --url https://indexer.actions.zeko.io --timeout-ms 30000 --json
moon run actions-indexer:diagnose-sync -f -- --url https://indexer.actions.zeko.io --timeout-ms 30000 --l1-archive-url https://api.minascan.io/archive/devnet/v1/graphql --l2-archive-url https://archive.testnet.zeko.io/graphql --outer-pk B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2 --inner-pk B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1 --json
moon run actions-indexer:diagnose-resources -f -- --project-id actions-indexer --service-id actions-indexer-deployment --duration-seconds 60 --json
```

Result:

- `typecheck`, `lint`, and `test-service-integration` passed.
- `diagnose-health` succeeded against `https://indexer.actions.zeko.io` with HTTP 200 and a measured latency of `27714ms`, proving the documented `--timeout-ms 30000` flag is now honored.
- `diagnose-sync` succeeded against the live endpoint and archives with both `outer` and `inner` streams reporting `status: ok`.
- `diagnose-resources` accepted documented kebab-case flags and failed at the real Northflank prerequisite with a clear login message: `Run 'pnpm exec northflank login' in services/actions/indexer first.`
- During investigation, one fresh-worktree run hit a corrupted Moon output hydration path for `packages/graphql`. A forced rebuild restored missing dist entrypoints, and standard `moon run actions-indexer:diagnose-health -- --url https://indexer.actions.zeko.io --timeout-ms 30000 --json` then succeeded normally.
