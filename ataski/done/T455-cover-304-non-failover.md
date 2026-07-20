---
id: T455
title: "Cover 304 non-failover"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-16T16:10:59Z
updated_at: 2026-07-16T16:12:18Z
---

## Requirements

- Add an explicit `@zeko/proxy-handler` unit test proving upstream `304 Not Modified` responses are returned directly and do not try backup URLs.
- Preserve current redirect failover coverage and normal 4xx non-failover coverage.
- Do not change runtime behavior unless the new regression test exposes a bug.

## Test Plan

- TDD with a narrow exception: this is regression coverage for behavior already implemented in `shouldFailoverResponse`, so the new test is expected to pass immediately rather than produce a RED failure.
- Run `./node_modules/.bin/moon run proxy-handler:test` and record the result.

## RED Evidence

- Test Strategy Exception: new coverage targets an already-implemented exclusion (`304` is not a failover response), so no failing RED step is expected before adding the regression test.

## GREEN Evidence

- `./node_modules/.bin/moon run proxy-handler:test` passed: 16 tests passed, including explicit 304 non-failover coverage.
