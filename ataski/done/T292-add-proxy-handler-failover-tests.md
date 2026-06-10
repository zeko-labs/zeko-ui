---
id: T292
title: "add-proxy-handler-failover-tests"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-09T00:00:00Z
updated_at: 2026-06-09T00:00:00Z
---

## Requirements

- Add a test harness for `packages/proxy-handler` using existing repo tooling.
- Add meaningful tests for `createProxyHandler` covering primary success, network failure failover, 5xx failover, ordered multiple backups, all targets unavailable, CORS, and 4xx no-failover behavior.
- Tests must target the new `primaryUrl` / `backupUrls` API only.
- Add a Moon `test` task for `proxy-handler`.
- Keep production logic changes minimal and only if tests expose a real issue.

## Test Plan

- Test strategy: TDD for implementation-level proxy failover behavior.
- RED path: add tests first and run `./node_modules/.bin/moon run proxy-handler:test`. Because task 01 already implemented the behavior before this test task, tests may pass immediately; if so, record that the planned RED was pre-satisfied by existing implementation rather than weakening tests.
- GREEN path: run `./node_modules/.bin/moon run proxy-handler:test` and `./node_modules/.bin/moon run proxy-handler:build`.

## RED Evidence

- 2026-06-09: Added 8 failover tests and ran `./node_modules/.bin/moon run proxy-handler:test`. The tests passed immediately because task 01 had already implemented the required behavior before this test-harness task. This pre-satisfied RED; tests still assert the old randomized/racing behavior would violate exact ordered call expectations.

## GREEN Evidence

- 2026-06-09: `./node_modules/.bin/moon run proxy-handler:test` passed: 1 file, 8 tests.
- 2026-06-09: `./node_modules/.bin/moon run proxy-handler:build` passed. Build completed with existing tsdown deprecation warning for `resolve.tsconfigFilename`.
