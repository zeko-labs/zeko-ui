---
id: T449
title: "Fix route minimum source of truth"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T17:02:08Z
updated_at: 2026-06-25T17:12:20Z
---

## Requirements

- Correct the selected route minimums so Mina to Zeko requires at least 5 MINA and Zeko to Mina requires at least 3 MINA.
- Define route minimum values in one shared source of truth and reuse that source for both input validation and fee disclosure copy.
- Keep the selected route fee notice compact and inline.
- Align the fee help marker horizontally with the route minimum text.
- Render the route direction with an icon instead of a textual arrow string.

## Test Plan

- TDD: update focused bridge input and bridge fee unit tests first so the current inverted and duplicated minimum logic fails.
- RED should prove that Mina to Zeko expects 5 MINA, Zeko to Mina expects 3 MINA, fee disclosure uses the shared minimum helper, and the fee notice renders route pieces with an icon rather than a textual arrow label.
- GREEN should pass the focused unit tests after the shared minimum and markup changes.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` failed as expected before runtime changes.
- Failure summary: Mina to Zeko minimum still returned `3` instead of `5`; fee disclosure still returned `minimumAmountMina: 3` without structured route labels; `BridgeFeeNotice.vue` still lacked `ArrowRight` and rendered `fees.bridgeMinimumLabel`.
- Post-commit focused rerun after the pre-commit formatter failed because the raw Vue source assertion expected single-line interpolation. The runtime behavior was unchanged, but the test needed whitespace-tolerant coverage.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` passed: 2 files, 7 tests.
- `moon run -f bridge-ui:lint` passed: Biome checked 117 files with no errors.
- `moon run -f bridge-ui:typecheck` passed: Nuxt typecheck completed after dependency builds.
- `moon run -f bridge-ui:test` passed: 31 files, 183 tests.
- `git diff --check` passed.
- Dev server hot-reloaded `Inputs.vue` and `BridgeFeeNotice.vue`. Browser smoke of the live input could not proceed in the plain page because the local browser has no Auro wallet extension, and standalone Playwright is not exposed in this checkout.
- After replacing the formatter-sensitive raw-source assertion, `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` passed: 2 files, 7 tests.
- After replacing the formatter-sensitive raw-source assertion, `moon run -f bridge-ui:lint` passed.
- After replacing the formatter-sensitive raw-source assertion, `moon run -f bridge-ui:test` passed: 31 files, 183 tests.
