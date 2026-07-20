---
id: T460
title: "address-layer-css-path-review"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---
## Requirements

- Address review feedback in `packages/layer/nuxt.config.ts`.
- Replace `new URL(..., import.meta.url).pathname` entries in the Nuxt `css` array with layer-root-relative CSS paths.
- Do not change unrelated runtime behavior.
- Do not commit or push.

## Test Plan

- DDD.
- This is a review/config portability fix. Validate by running the smallest relevant Moon checks: `layer:lint` and `bridge-ui:typecheck` because bridge-ui extends the layer.

## RED Evidence

- Review identified `new URL(..., import.meta.url).pathname` in the layer Nuxt `css` array as non-portable on Windows.

## GREEN Evidence

- Replaced layer Nuxt `css` array entries and PostCSS global-data file path with root-relative strings.
- Replaced bridge-ui Nuxt TypeScript include paths with relative strings.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run layer:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
