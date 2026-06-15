---
id: T349
title: "Preserve local control origin"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-15T17:03:16Z
updated_at: 2026-06-15T17:47:08Z
---

## Requirements

- Local dashboard control requests from `http://localhost:<port>` must pass the same-origin guard when the browser sends a matching `Origin` header and the dev server does not send `x-forwarded-proto`.
- Production/proxy deployments must continue to honor `x-forwarded-proto` and `x-forwarded-host`.
- Cross-site and non-JSON control requests must remain rejected.

## Test Plan

- TDD: add a focused unit test for the control request origin resolver showing that localhost uses the `Origin` protocol when forwarded proto is absent, while forwarded proto/host still win in proxy-style requests.

## RED Evidence

- `moon run -f actions-dashboard:test` failed with the new local-control origin regression test: `resolveControlRequestOrigin` was not implemented/exported, so the route still used its untested local `https` fallback path.

## GREEN Evidence

- `moon run -f actions-dashboard:test` passed: `apps/actions-dashboard/test/ops.test.ts`, 29 tests.
- `moon run -f actions-dashboard:typecheck actions-dashboard:lint actions-dashboard:build` passed, including dashboard typecheck, Biome lint, and Nuxt Cloudflare module build.
