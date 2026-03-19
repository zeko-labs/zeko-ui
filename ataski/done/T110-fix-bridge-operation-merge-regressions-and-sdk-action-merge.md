---
id: T110
title: "Fix bridge operation merge regressions and sdk action merge"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T21:45:00Z
updated_at: 2026-03-19T22:05:00Z
---

## Requirements

- Make sure the `bridgeOperation.ts` regression is caught by repo checks before fixing it.
- Update pre-commit / verification so the broken pending capability handling is rejected automatically.
- Fix the bridge UI merge regression without reintroducing local-only API shapes.
- Remove `mergeUniqueActions` from `bridge-sdk` and keep the merged branch aligned with `main`.
- Run the relevant bridge UI and bridge SDK validation, then commit and push the fixes.

## Test Plan

- RED: add a bridge UI regression test that fails with the current pending capability handling.
- RED: ensure the pre-commit hook runs the bridge UI typecheck plus the new regression test.
- GREEN: fix the bridge UI pending capability handling and remove `mergeUniqueActions`.
- GREEN: rerun the bridge UI and bridge SDK test/typecheck/build verification, plus a pre-commit run.

## RED Evidence

- `bridgeOperation.ts` was treating capability diagnostics as booleans, so unavailable results still transitioned the machine toward finalization.
- `bridge-ui:typecheck` did not catch that shape drift until the bridge operation code was changed to require boolean capability values explicitly.
- Before fixing the worker boundary, `pnpm exec moon run bridge-ui:typecheck` failed with:
  - `machines/bridgeOperation.ts(193,13): error TS2322`
  - `machines/bridgeOperation.ts(246,12): error TS2322`

## GREEN Evidence

- The bridge UI worker now converts SDK capability diagnostics to booleans before exposing them to `bridgeOperation.ts`.
- `bridgeOperation.ts` now requires boolean capability values explicitly, so a future merge that leaks diagnostic objects into the UI boundary will fail typecheck immediately.
- `mergeUniqueActions` was removed from `bridge-sdk`; withdrawal action fetches now use the archive slice plus the action-state-bounded live slice directly.
- Validation passed:
  - `pnpm exec moon run bridge-ui:typecheck bridge-ui:test bridge-sdk:typecheck bridge-sdk:test`
  - `pnpm exec lefthook run pre-commit`
