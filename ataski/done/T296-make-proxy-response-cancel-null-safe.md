---
id: T296
title: "make-proxy-response-cancel-null-safe"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-09T00:00:00Z
updated_at: 2026-06-09T00:00:00Z
---
## Requirements

- Evaluate the review finding about `response.body?.cancel().catch(...)` in `packages/proxy-handler/src/index.ts`.
- Make `cancelResponseBody` explicitly check for a response body before calling `cancel()`.
- Preserve current failover and cleanup behavior.

## Test Plan

- Test strategy: TDD would normally apply to behavior changes, but this is a defensive readability cleanup after evaluation showed the existing optional-chain expression does not throw for `new Response(null).body === null` in the current runtime.
- Test Strategy Exception: record the runtime evaluation before source edits, then validate with the existing proxy-handler test and build tasks.

## RED Evidence

- 2026-06-09: `node -e 'const response = new Response(null); try { void response.body?.cancel().catch(() => undefined); console.log("no throw", response.body); } catch (error) { console.error("threw", error); process.exit(1); }'` printed `no throw null`. The review concern is not valid for current JavaScript optional chaining semantics, but the suggested explicit guard is clearer and safe.

## GREEN Evidence

- 2026-06-09: `nix develop -c bash -lc 'pnpm exec moon run proxy-handler:test && pnpm exec moon run proxy-handler:build'` passed. Test suite: 11 tests passed. Build passed with existing tsdown deprecation warning for `resolve.tsconfigFilename`.
