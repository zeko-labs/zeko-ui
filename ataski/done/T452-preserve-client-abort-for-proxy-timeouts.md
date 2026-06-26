---
id: T452
title: "Preserve client abort for proxy timeouts"
status: done
blockedBy: []
owner: pi
created_at: 2026-06-26T13:44:32Z
updated_at: 2026-06-26T13:48:22Z
---

## Requirements

- Evaluate and address the review finding for `packages/proxy-handler/src/index.ts` timeout fetch handling.
- When upstream timeout handling is enabled, a client/request abort must abort the in-flight upstream fetch instead of waiting for the proxy timeout.
- Preserve existing timeout failover behavior: actual upstream timeouts still abort, try backups, and return 504 when every backend times out.
- Avoid unnecessary request wrapping when applying the timeout signal if `fetch(request, { signal })` is sufficient.
- Add mina-proxy-devnet to changeset

## Test Plan

- TDD: add a proxy-handler test proving a client abort propagates to upstream fetch before `upstreamTimeoutMs` elapses. Confirm it fails against the current code, then implement the linked abort handling.
- Re-run `proxy-handler:test` through `nix develop`.

## RED Evidence

- `nix develop -c bash -lc 'pnpm exec moon run proxy-handler:test -f'` failed before implementation: the new client-abort test timed out after 5s because the upstream fetch signal was not linked to the incoming request signal.

## GREEN Evidence

- `nix develop -c bash -lc 'pnpm exec moon run proxy-handler:test -f && pnpm exec moon run proxy-handler:build -f'` passed: 14 tests and proxy-handler build completed.
