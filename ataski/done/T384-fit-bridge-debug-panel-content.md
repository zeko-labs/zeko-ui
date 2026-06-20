---
id: T384
title: "fit bridge debug panel content"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T04:28:05Z
updated_at: 2026-06-19T04:43:55Z
---

## Requirements

- Fix the bridge-ui debug backend panel so its internal content fits within the panel width.
- Remove the horizontal scrollbar caused by operation rows, long scenario names, hashes, IDs, or exported JSON.
- Keep the panel usable at narrow viewport widths where the panel is capped to `calc(100vw - 2rem)`.
- Keep the change scoped to the debug panel layout and do not alter mock backend behavior.

## Test Plan

- BDD: first reproduce the user-visible failure by measuring the panel's horizontal overflow in mock-backend debug mode at a narrow viewport. RED is present when the panel's `scrollWidth` exceeds its `clientWidth`.
- GREEN validation will verify the panel no longer horizontally overflows at the same narrow viewport after the CSS fix, then run focused bridge-ui validation.

## RED Evidence

- `pnpm --dir apps/bridge-ui exec node --input-type=module -e '<playwright overflow measurement>'`
  reproduced the panel overflow at a 390px viewport: `.BridgeDebugPanel`
  `clientWidth` was `356` while `scrollWidth` was `576`; `.DebugRow` measured
  `544`px wide due to its fixed minimum width.

## GREEN Evidence

- User verified the debug panel visually in the local browser after the CSS-only
  layout change and reported: "it looks fine now".
- `moon run bridge-ui:test -f` passed: 25 files, 130 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
- `git diff --check` passed.
