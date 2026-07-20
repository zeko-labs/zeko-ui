---
id: T456
title: "Avoid duplicating proxy endpoint paths"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-16T16:42:40Z
updated_at: 2026-07-16T16:44:10Z
---

## Requirements

- Fix `@zeko/proxy-handler` target URL construction so a backend URL that already ends with the incoming request path does not append the same path again.
- Specifically, `primaryUrl=https://api.minascan.io/node/devnet/v1/graphql` with request `/graphql` must target `/node/devnet/v1/graphql`, and `backupUrl=https://mina.devnet.zeko.io/graphql` with request `/graphql` must target `/graphql`, not `/graphql/graphql`.
- Preserve existing behavior where base paths that do not already end with the request path are joined, such as `/api` + `/graphql` -> `/api/graphql`.
- Keep redirect failover behavior and existing non-failover behavior unchanged.

## Test Plan

- TDD: add a failing `packages/proxy-handler` unit test covering backend URLs that already include `/graphql`, a primary 307, and a backup 200. The test must assert both requested upstream URLs do not contain duplicated `/graphql/graphql`.
- Run `./node_modules/.bin/moon run proxy-handler:test` for RED and GREEN evidence.

## RED Evidence

- `./node_modules/.bin/moon run proxy-handler:test` failed as expected: new endpoint-path test showed upstream URLs were incorrectly requested as `/graphql/graphql` for both primary and backup.

## GREEN Evidence

- `./node_modules/.bin/moon run proxy-handler:test` passed: 17 tests passed, including endpoint-path deduplication with primary 307 failover to backup.
