---
id: T289
title: "Fix Musea component path guard"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-11T00:00:00+07:00
updated_at: 2026-06-11T00:00:00+07:00
---

## Requirements

- Fix the Musea component detail route error where opening an art file reports that the component path escapes the allowed directory.
- Keep layer component references reviewable without changing runtime layer components.
- Validate the Musea gallery build/typecheck after changing art source paths.
- Restart the local Musea dev server so the in-app browser can verify the fix.

## Test Plan

- DDD: reproduce the failing component detail URL, inspect Musea path expectations, then add the layer component directory to Musea's scan roots so relative source component paths are inside the allowed set.
- Run `moon run -f musea:typecheck` and `moon run -f musea:build`.
- Restart the Musea dev server and verify the component route responds.

## RED Evidence

- Opening the Button art detail route in the in-app browser reports `component path escapes the allowed directory`.
- All art files used `defineArt("../../../layer/...")`, which traverses out of `packages/musea` to reach the layer package.
- Replacing the component paths with `@zeko/layer/...` compiled, but the Musea analysis endpoint resolved the alias as a relative filesystem path and failed with `ENOENT`.

## GREEN Evidence

- Added `../layer/app/components/**/*.vue` to the Musea plugin `include` list so the layer component directory becomes an allowed source root while art discovery still finds the same seven art files.
- Kept the relative `defineArt("../../../layer/...")` paths so Musea can resolve the component source files for analysis.
- Restarted the local Musea dev server.
- Confirmed the Button art `palette`, `analysis`, `docs`, and `source` API endpoints return 200.
- Confirmed `GET /__musea__/api/arts` returns seven art files: Button, FooterSocial, Label, Layer SVG Icons, Navigation, NavigationItem, and NavigationSound.
- `moon run -f musea:lint` passed.
- `moon run -f musea:typecheck` passed.
- `moon run -f musea:build` passed.
