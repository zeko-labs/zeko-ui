---
id: T288
title: "Expand Musea layer coverage"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-11T00:00:00+07:00
updated_at: 2026-06-11T00:00:00+07:00
---

## Requirements

- Add Musea art coverage beyond the initial Button proof of concept.
- Cover all shared layer components that can render in the dedicated Musea Vite project.
- Keep Nuxt runtime requirements explicit with preview-only shims instead of changing app behavior.
- Validate Musea locally with Moon build and typecheck tasks.

## Test Plan

- DDD: inspect each layer component for props, Nuxt globals, and auto-import assumptions before adding art coverage.
- Add preview setup and art files, then run `moon run -f musea:typecheck` and `moon run -f musea:build`.

## RED Evidence

- `packages/musea/src/art/Button.art.vue` was the only art file, so most shared layer components had no Musea coverage.
- Several layer components rely on Nuxt preview context (`NuxtLink`, `ClientOnly`, `useRuntimeConfig`) or Nuxt auto-imported Vue APIs (`ref`, `onMounted`) that are not present in a plain Vite preview by default.
- The first `moon run -f musea:typecheck` failed on missing `useRuntimeConfig`, `ref`, and `onMounted` globals from imported layer components.

## GREEN Evidence

- Added Musea art coverage for Button variants, Label states, FooterSocial, Navigation, NavigationItem, NavigationSound, and the shared layer SVG icon set.
- Added Musea-only preview shims for `NuxtLink`, `ClientOnly`, `useRuntimeConfig`, `ref`, and `onMounted`.
- `moon run -f musea:lint` passed.
- `moon run -f musea:typecheck` passed.
- `moon run -f musea:build` passed and found 7 art files.
- `musea:build` still emits the Vize/Vite `vue/dist/vue.esm-bundler.js` alias warning. An exact local Vue alias did not suppress it, so no ineffective config change was kept.
