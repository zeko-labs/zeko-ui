---
id: T290
title: "remove-proxy-hostnames-compat"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-09T00:00:00Z
updated_at: 2026-06-09T00:00:00Z
---

## Requirements

- Remove temporary legacy `hostnames` compatibility from `packages/proxy-handler/src/index.ts`.
- `createProxyHandler` should only accept the new explicit `primaryUrl` and optional `backupUrls` API.
- Keep primary-first ordered failover behavior unchanged.
- Do not update worker service files yet; those are covered by the next planning task.

## Test Plan

- Test strategy: TDD would normally cover API compatibility removal, but automated tests are scheduled in feature task 02 and no test harness exists yet.
- Test Strategy Exception: record this before source edits; validate with `./node_modules/.bin/moon run proxy-handler:build` for this narrow API cleanup.

## RED Evidence

- 2026-06-09: Test Strategy Exception recorded before source edits. No package test harness exists yet; task 02 remains responsible for automated failover tests.

## GREEN Evidence

- 2026-06-09: `./node_modules/.bin/moon run proxy-handler:build` passed. Build completed with existing tsdown deprecation warning for `resolve.tsconfigFilename`.
