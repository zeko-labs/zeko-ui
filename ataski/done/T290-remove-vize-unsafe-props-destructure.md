---
id: T290
title: "Remove Vize-unsafe props destructure"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-11T00:00:00+07:00
updated_at: 2026-06-11T22:18:56+07:00
---

## Requirements

- Fix Musea rendering failures caused by Vize output leaving destructured `defineProps` bindings undefined.
- Replace destructured `defineProps` usage in Vue/Nuxt components covered by this Vize adoption PR with explicit props objects.
- Preserve existing defaults and template behavior.
- Validate Musea and the affected Nuxt bridge app after the rewrite.

## Test Plan

- DDD: reproduce the Button Musea error, identify all matching destructured `defineProps` usages, then rewrite them to explicit props access.
- Run Musea lint/typecheck/build and bridge UI typecheck/build after the change.
- Restart the Musea dev server and verify the Button route no longer reports `variant is not defined`.

## RED Evidence

- Musea failed to render Button with `ReferenceError: variant is not defined`.
- `packages/layer/app/components/Button.vue` used `const { variant = "default" } = defineProps<Props>()`.
- `rg` found the same destructured `defineProps` pattern in layer components and bridge UI components.

## GREEN Evidence

- Replaced destructured `defineProps` usage in the layer components and affected bridge UI components with explicit `props` objects.
- `moon run -f musea:typecheck` passed.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f layer:typecheck` passed as a no-op task.
- `moon run -f musea:build` passed.
- `moon run -f bridge-ui:build` passed.
- `moon run -f musea:lint` passed.
- `moon run -f faucet-ui:build` passed.
- `moon run -f lb-ui:build` passed.
- Restarted the Musea dev server on port 6077.
- Verified the transformed Button module now references `props.variant` instead of bare `variant`.
- Verified the Musea Button component route renders READY with 10 variants and no `variant is not defined` error in the in-app browser.
