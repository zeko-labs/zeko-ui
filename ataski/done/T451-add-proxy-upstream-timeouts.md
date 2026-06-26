---
id: T451
title: "Add proxy upstream timeouts"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-26T10:31:40Z
updated_at: 2026-06-26T10:35:33Z
---

## Requirements

- Add configurable per-upstream fetch timeout support to `@zeko/proxy-handler`.
- A hanging primary request must be aborted after the configured timeout and the handler must try configured backup URLs sequentially.
- A hanging backup request must also be aborted after the configured timeout.
- If every backend times out or fails without a usable response, return a bounded error response instead of hanging; timeout-only exhaustion should return `504 Gateway Timeout`.
- Configure `services/mina-proxy-devnet`, `services/mina-proxy-mainnet`, `services/mina-archive-proxy-devnet`, and `services/mina-archive-proxy-mainnet` to use a 3 second upstream timeout while preserving existing CORS and backup URL behavior.
- Do not change websocket proxying behavior unless needed for correctness.

## Test Plan

- TDD: first add proxy-handler tests that simulate never-settling upstream fetches and verify timeout abort, backup fallback, and final 504 behavior before implementation.
- Validate with the `proxy-handler:test` Moon task after implementation.

## RED Evidence

- `./node_modules/.bin/moon run proxy-handler:test -f` failed before implementation: new timeout tests hung until Vitest's 5s test timeout because upstream fetches were not aborted.

## GREEN Evidence

- `./node_modules/.bin/moon run proxy-handler:test -f` passed: 13 tests.
- `./node_modules/.bin/moon run proxy-handler:build -f` passed.
