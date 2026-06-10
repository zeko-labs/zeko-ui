---
id: T321
title: "Fix production Cloudflare env"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T16:42:45Z
updated_at: 2026-06-10T16:48:02Z
---

## Requirements

- Fix the deployed dashboard API so production Cloudflare module requests read Worker bindings from Nitro's production request context.
- Preserve the dev-context and local `process.env` fallback behavior.
- Keep indexer tokens private to the server route.
- Add regression tests for the production context shape.

## Test Plan

- BDD: add a failing unit-level acceptance test around the server API env resolver with Nitro's production `_platform.cloudflare.env` shape, then update the handlers to use that shape.

## RED Evidence

- The dashboard still shows the action-indexer as `error` with missing DB/indexer fields after refresh.
- Nitro's Cloudflare module runtime calls `nitroApp.localFetch` with bindings at `event.context._platform.cloudflare.env`.
- The current dashboard API handlers only read `event.context.cloudflare.env`, which is the dev plugin shape, then fall back to `process.env`.

## GREEN Evidence

- Added `resolveEventEnv` to read Nitro production bindings from `event.context._platform.cloudflare.env`.
- Preserved fallbacks for the dev plugin shape, `globalThis.__env__`, and local `process.env`.
- Updated `/api/ops/status` and `/api/ops/control` to use the shared resolver.
- Added regression tests for production `_platform.cloudflare.env` and dev `cloudflare.env` context shapes.
- Added indexer probe error formatting so failed probes do not render as literal `null`.
- Added explicit non-OK health/status error messages for the action-indexer probe.
- Deployed Worker version `7e6455f5-0981-4701-85d9-d026c129c258` with the production env resolver fix.
- Deployed Worker version `bc9d0c71-d857-43b7-ac6f-79b50d976894` with the null-error hardening.

## Validation

- `moon run ops-dashboard:test`
- `moon run ops-dashboard:lint`
- `moon run ops-dashboard:typecheck`
- `moon run ops-dashboard:deploy`
