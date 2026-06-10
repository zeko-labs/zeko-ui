---
id: T295
title: "avoid-final-proxy-request-clone"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-09T00:00:00Z
updated_at: 2026-06-09T00:00:00Z
---
## Requirements

- Verify the review finding in `packages/proxy-handler/src/index.ts` about cloning the request on every backend attempt.
- Avoid cloning the original request for the last backend attempt because no later retry needs the request body.
- Preserve cloning for attempts that still have remaining backup targets.
- Preserve existing failover behavior and tests.

## Test Plan

- Test strategy: TDD for implementation-level request cloning behavior.
- RED path: add tests that spy on `Request.prototype.clone` and prove single-primary requests do not clone, while a primary+backup request clones only the non-final attempt.
- GREEN path: implement the smallest clone-selection change and run `moon run proxy-handler:test` plus `moon run proxy-handler:build`.

## RED Evidence

- 2026-06-09: Added clone-count tests. `nix develop -c bash -lc 'pnpm exec moon run proxy-handler:test'` failed as expected: single-primary request cloned once, and primary+backup request cloned twice instead of once.

## GREEN Evidence

- 2026-06-09: `nix develop -c bash -lc 'pnpm exec moon run proxy-handler:test && pnpm exec moon run proxy-handler:build'` passed. Test suite: 11 tests passed. Build passed with existing tsdown deprecation warning for `resolve.tsconfigFilename`.
