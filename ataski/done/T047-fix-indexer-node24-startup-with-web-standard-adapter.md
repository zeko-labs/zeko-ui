---
id: T047
title: "Fix indexer Node 24 startup with Elysia WebStandard adapter"
status: done
blockedBy: [T046]
owner: codex
created_at: 2026-03-09T12:14:00Z
updated_at: 2026-03-09T18:53:55Z
---

## Scope

Fix indexer service startup under Node 24 so integration tests can start the real service and execute endpoint/CLI checks.

## TDD Exception

This fix targets runtime bootstrap behavior and is validated through the docker-backed integration suite and existing moon typecheck/lint checks.

## GREEN Evidence

```bash
pnpm install
moon run actions-indexer:typecheck -f
moon run actions-indexer:lint -f
moon run actions-indexer:test-service-integration -f
```

Result:

- Replaced custom Node HTTP bridge approach with Elysia's official Node adapter (`@elysiajs/node`) and restored simple `server.listen(port)` startup.
- Docker-backed integration suite now passes end-to-end (3/3 tests), including live health/lifecycle and CLI checks.
