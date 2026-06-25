---
id: T437
title: "Fix bridge verification regressions"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T11:18:42Z
updated_at: 2026-06-25T11:18:42Z
---

## Requirements

- Fix the amount input regression where entering any amount leaves Send disabled because the input model value is a string instead of a number.
- Keep the below-2 MINA red invalid state and disabled Send behavior, but enable Send for valid numeric values at or above 2 MINA.
- Use precise verification terminology: Reset clears debug backend state; Sim Refresh rebuilds operation actors from debug backend state.
- Remove avoidable debug verification console noise from notification/service-worker and metrics paths when running local/mock-backend scenarios.
- Update selected-route fee copy/style: smaller italic explanatory text and exact account-creation language rather than approximate wording.
- Do not include already-working unindexed/pending verification in the new walkthrough.
- Keep `AGENTS.md` bridge UI verification instructions intact or strengthen them if needed.

## Test Plan

- BDD.
- RED: add failing coverage for string numeric amount input values enabling Send/canStart at 2+ MINA, exact fee copy, and notification/metrics no-op behavior in debug/local conditions.
- GREEN: coerce the amount model correctly, adjust fee copy/style, and suppress local/mock-backend notification/metrics console noise without hiding real bridge errors.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts test/unit/notifications.test.ts test/unit/metrics.test.ts` failed as expected:
  - `canStartBridgeOperation` returned `false` for the string model value `"2"`.
  - `BridgeFeeNotice.vue` still contained approximate fee wording instead of exact route details.
  - notification dispatch requested permission/logged before confirming service worker registration.
  - metrics did not expose or apply local/mock-backend skip logic.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts test/unit/notifications.test.ts test/unit/metrics.test.ts` passed: 4 files, 9 tests.
- `moon run -f bridge-ui:format-fix` passed and formatted 2 files.
- `moon run -f bridge-ui:test` passed: 31 files, 171 tests.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:lint` passed.
- Browser dev-server smoke on `http://127.0.0.1:4300/` with a mocked Auro wallet provider and `bridgeDebugMode=mock-backend`:
  - entering `1.99` kept Send disabled and the amount selector had `SelectWrapper isInvalid`.
  - entering `2` enabled Send and the amount selector had `SelectWrapper`.
  - filtered console output had no service-worker registration error, `/metrics` failure, or duplicate actor error.
