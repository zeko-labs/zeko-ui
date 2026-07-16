---
id: T454
title: "Fail over on upstream redirect"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-16T15:56:24Z
updated_at: 2026-07-16T15:58:25Z
---

## Requirements

- Update `@zeko/proxy-handler` failover behavior so an upstream `307 Temporary Redirect` response from the primary Mina endpoint is treated as unavailable and the proxy tries configured backup URLs.
- Preserve existing behavior where normal client 4xx responses do not fail over.
- Keep the last unavailable upstream response as the response only when all backends are unavailable.
- Add automated coverage proving 307 failover and continued non-failover for normal 4xx.

## Test Plan

- TDD: first add a failing `packages/proxy-handler` unit test that returns 307 from the primary and 200 from backup, expecting the backup response and both upstream URLs to be requested.
- Run `moon run proxy-handler:test` from repo root for RED and GREEN evidence.

## RED Evidence

- `./node_modules/.bin/moon run proxy-handler:test` failed as expected: new `tries the first backup after a primary 307 redirect response` test received status 307 instead of expected backup status 200.
- `moon run proxy-handler:test` and `pnpm exec moon run proxy-handler:test` could not run in this shell because `moon`/`pnpm` are not on PATH; used repository-local `./node_modules/.bin/moon`.

## GREEN Evidence

- `./node_modules/.bin/moon run proxy-handler:test` passed: 15 tests passed, including 307 redirect failover coverage.
