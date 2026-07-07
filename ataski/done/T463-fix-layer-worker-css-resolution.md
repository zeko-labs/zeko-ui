---
id: T463
title: "fix-layer-worker-css-resolution"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Evaluate and fix the Workers build failure caused by `packages/layer/nuxt.config.ts` not resolving layer CSS from consuming apps.
- Prefer a cross-platform solution that avoids `node:path` and `node:url` imports.
- Do not commit or push.

## Test Plan

- DDD.
- Validate with `bridge-ui:typecheck` and the smallest practical build check if available.

## RED Evidence

- Worker build error reported: `[UNRESOLVED_IMPORT] Could not resolve './app/assets/styles/layer.css'` after changing layer CSS entries to relative paths.

## GREEN Evidence

- Restored layer asset paths to the earlier `new URL(..., import.meta.url).pathname` implementation in `packages/layer/nuxt.config.ts`.
- Dropped the later `import.meta.dirname` and `createResolver` attempts.
