---
id: T078
title: "Add bridge-sdk changeset and clean test config"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T17:42:56Z
updated_at: 2026-03-11T17:56:00Z
---

## Requirements

- Add the required changeset for the published `@zeko-labs/bridge-sdk` package.
- Remove the current Vitest alias workaround in `packages/bridge-sdk/vitest.config.ts` and replace it with a more robust approach that works cleanly in CI and local development.
- Reduce unnecessary repetition in the new validation/schema code where it materially improves maintainability without changing behavior.
- Keep the existing bridge-sdk diagnostics behavior intact unless a refactor requires a targeted update.

## Test Plan

- DDD
- Re-run `moon run bridge-sdk:test -f` and `moon run bridge-sdk:typecheck -f`.
- If the test-config approach changes dependency ordering or build assumptions, validate it from a clean enough state to cover the CI failure mode.

## RED Evidence

## Test Strategy Exception

This task mixes packaging metadata and targeted internal refactors. The main risk is CI/runtime configuration rather than a missing product assertion, so the work will validate behavior with focused command-level checks after the refactor rather than introducing a synthetic RED test first.

## GREEN Evidence

- Added `.changeset/five-cities-grin.md` for `@zeko-labs/bridge-sdk` as a patch release.
- Removed `packages/bridge-sdk/vitest.config.ts`; the test task now relies on normal workspace package resolution plus the existing `deps: ^:build` ordering in `packages/bridge-sdk/moon.yml` instead of a package alias override.
- Verified the alias removal against the original CI failure mode by temporarily moving `packages/graphql/dist` aside and running `moon run bridge-sdk:test -f`; Moon rebuilt `graphql` first and the diagnostics suite passed.
- Reduced validation repetition in `packages/bridge-sdk/src/utils.ts` by centralizing `safeParse` error handling in `parsePayload`, hoisting reused wrapper schemas, and reusing a single outer-action mapper without changing payload contracts or public return types.
- Validation:
  - `moon run bridge-sdk:test -f`
  - `moon run bridge-sdk:typecheck -f`
