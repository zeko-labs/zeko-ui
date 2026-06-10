---
id: T289
title: "mina-proxy-primary-backup-api"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-09T00:00:00Z
updated_at: 2026-06-09T00:00:00Z
---

## Requirements

- Update `packages/proxy-handler/src/index.ts` for `.planning/features/001-mina-proxy-backup-failover/tasks/01-update-proxy-handler-api.md`.
- Add explicit `primaryUrl: string` and optional `backupUrls: readonly string[]` configuration to `createProxyHandler`.
- Preserve temporary `hostnames: readonly string[]` compatibility only if needed for existing callers.
- Normal HTTP requests must try primary first, then backups in configured order.
- Network errors and backend `5xx` responses trigger failover.
- Non-`5xx` responses must return without failover.
- If all targets fail, return the last backend `5xx` response when available, otherwise a `502` proxy error.
- Preserve CORS, request path/query forwarding, HTML websocket URL fix, and existing WebSocket upgrade support.
- Do not update service worker files in this task.

## Test Plan

- Test strategy: TDD is preferred for this implementation-level proxy behavior.
- Test Strategy Exception: this package currently has no test harness and feature task `02-add-proxy-handler-tests.md` is dedicated to adding meaningful automated tests immediately after this API task. For this task only, pre-edit validation will be the existing Moon build, and GREEN evidence will be `moon run proxy-handler:build`. Automated RED/GREEN tests remain mandatory for the feature and are tracked in task 02.

## RED Evidence

- 2026-06-09: Test Strategy Exception recorded before source edits. Existing package has no test task/harness; task 02 will add automated failover tests.

## GREEN Evidence

- 2026-06-09: `./node_modules/.bin/moon run proxy-handler:build` passed. Build completed with existing tsdown deprecation warning for `resolve.tsconfigFilename`.
