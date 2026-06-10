---
id: T294
title: "cancel-superseded-proxy-5xx-responses"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-09T00:00:00Z
updated_at: 2026-06-09T00:00:00Z
---
## Requirements

- Verify the review finding in `packages/proxy-handler/src/index.ts` about overwritten 5xx `Response` bodies.
- When a backend returns 5xx and an earlier 5xx response is already stored as `lastUnavailableResponse`, cancel the earlier response body before overwriting it.
- Ignore cancellation failures so failover behavior is not affected.
- Preserve returning the final 5xx response when all backends are unavailable.

## Test Plan

- Test strategy: TDD for proxy resource cleanup behavior.
- RED path: add a test that returns two sequential 5xx responses with cancellable bodies and asserts the first body is cancelled before the second response is returned.
- GREEN path: implement the smallest cleanup change and run `moon run proxy-handler:test` plus `moon run proxy-handler:build`.

## RED Evidence

- 2026-06-09: Added regression test for cancelling a superseded 5xx response body. `nix develop -c bash -lc 'pnpm exec moon run proxy-handler:test'` failed as expected: `cancels superseded 5xx response bodies` expected cancel to be called once, got 0.

## GREEN Evidence

- 2026-06-09: `nix develop -c bash -lc 'pnpm exec moon run proxy-handler:test && pnpm exec moon run proxy-handler:build'` passed. Test suite: 9 tests passed. Build passed with existing tsdown deprecation warning for `resolve.tsconfigFilename`.
