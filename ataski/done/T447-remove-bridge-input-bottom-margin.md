---
id: T447
title: "Remove bridge input bottom margin"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T16:52:13Z
updated_at: 2026-06-25T16:54:34Z
---

## Requirements

- Remove the accidental `.Bottom { margin-bottom: 2rem; }` rule from `Inputs.vue`.
- Keep the requested `.Bottom` `gap: 2rem` rule unchanged.
- Preserve the compact bridge notice, route-specific minimums, and native-title fee tooltip behavior.
- Add a regression assertion that the bridge input CSS does not add bottom margin spacing.

## Test Plan

- BDD: update the bridge input copy/style unit test so it fails while `.Bottom` still contains `margin-bottom: 2rem`.
- RED should prove the layout regression exists before implementation.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts` fails before implementation because `Inputs.vue` still has `.Bottom { margin-bottom: 2rem; }`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts` passed: 1 file, 3 tests.
- `moon run -f bridge-ui:format-fix && moon run -f bridge-ui:typecheck && moon run -f bridge-ui:lint && git diff --check` passed.
- `moon run -f bridge-ui:test` passed: 31 files, 183 tests.
