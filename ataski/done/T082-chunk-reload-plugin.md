---
id: T082
title: "Chunk reload handler plugin"
status: todo
blockedBy: []
owner: unassigned
created_at: 2026-03-12T00:00:00Z
updated_at: 2026-03-12T00:00:00Z
---

## Requirements

Create `apps/bridge-ui/app/plugins/chunk-reload.client.ts` to handle stale deployment cache errors (WEB-302, WEB-145, WEB-180).

The plugin must:

1. Listen for `vite:preloadError` events on the window (Nuxt/Vite fires this when dynamic imports fail).
2. On detection, prompt the user to reload the page.
3. Use `window.location.reload()` to reload.
4. Prevent infinite reload loops by tracking reload attempts in `sessionStorage`.

Errors addressed:

- WEB-302: `[GET] /_nuxt/builds/meta/...json: Failed to fetch`
- WEB-145: `Failed to fetch dynamically imported module`
- WEB-180: `Importing a module script failed`

## Test Plan

Test Strategy Exception: This is a Nuxt client-side plugin that depends on Vite's runtime preload mechanism and `window.location.reload()` — neither can be meaningfully tested in vitest/node. GREEN evidence is a successful build + typecheck.

## RED Evidence

## GREEN Evidence
