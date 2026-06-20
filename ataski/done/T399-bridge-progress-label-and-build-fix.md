---
id: T399
title: "Bridge progress label and build fix"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T14:24:54Z
updated_at: 2026-06-19T15:24:12Z
---

## Requirements

- Display a discreet operation progress label such as `1 confirmation remaining` when the active bridge operation is waiting for SDK/indexer watermarks to catch up.
- Base the progress only on realistic SDK-shaped data: the operation action index and the corresponding fetched bridge progress index. Do not use queue position, timers, or debug-only hacks.
- Keep the label compact enough to fit in the current operation UI without changing the completed transaction copy.
- Fix the bridge-ui Nuxt build failure revealed by CI on the debug-mode PR.
- Keep debug mode truthful: any mock backend support must preserve the same interface and avoid hiding real bridge UI bugs.

## Test Plan

- BDD.
- RED: add focused expectations for the progress label formatting and reproduce the current bridge-ui build failure before implementation.
- GREEN: implement progress propagation and the build fix, then run the focused bridge-ui tests, lint, typecheck, and build.

## RED Evidence

- `moon run -f bridge-ui:build` failed before implementation in the SSR bundle with Nuxt Build Error from `nuxt:tree-shake-composables:transform` on `apps/bridge-ui/app/composables/useBridgeDebugBackend.ts`: `Cannot split a chunk that has already been edited`.
- `moon run -f bridge-ui:test -- test/unit/helpers-progress.test.ts` failed before implementation because `apps/bridge-ui/app/helpers.ts` did not export `operationProgressLabel`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/helpers-progress.test.ts test/unit/bridge-operation.test.ts test/unit/recovery.test.ts test/unit/mock-backend-worker.test.ts` passed: 4 files, 46 tests.
- `moon run -f bridge-ui:lint` passed: Biome checked 109 files with no errors.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:build` passed, including the previously failing SSR bundle for `useBridgeDebugBackend.ts`.
- `moon run -f bridge-ui:test` passed: 27 files, 147 tests.
