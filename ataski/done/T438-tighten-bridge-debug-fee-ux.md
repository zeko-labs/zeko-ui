---
id: T438
title: "Tighten bridge debug and fee UX"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T11:46:56Z
updated_at: 2026-06-25T12:01:00Z
---

## Requirements

- Change the `.Bottom` gap in `Inputs.vue` from `1rem` to `2rem`.
- Remove the confusing `2.4 MINA` first-withdrawal debug scenario threshold and align the debug backend message with the fee logic: `0.2 MINA bridge fees + 1 MINA helper account creation + 1 MINA recipient account creation = 2.2 MINA`.
- Keep the first-withdrawal-too-small scenario faithful to a backend worker error, not a UI-only shortcut.
- Preserve the selected debug scenario when clicking Reset, and make Reset rebuild visible operation actors so manual verification does not require a separate Sim Refresh click.
- Do not hide real notification or metrics problems in production. Local/mock-backend should stay quiet for verification noise, but production metrics and service-worker notification failures should still be observable through the existing code paths.
- Reduce fee-row verbosity by moving detailed bridge/account-creation explanations into tooltips.
- Add clear accessible tooltips for fee details so users can understand route fees without long inline copy.

## Test Plan

- BDD.
- RED: add or extend focused tests for `.Bottom` spacing, 2.2 MINA first-withdrawal message, scenario-preserving Reset plus actor rebuild behavior, production/local metrics gating, and fee tooltip copy replacing verbose inline copy.
- GREEN: update UI/debug code to satisfy those tests, then run targeted bridge-ui tests plus format, full bridge-ui tests, typecheck, lint, and browser smoke where applicable.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-fees.test.ts test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/wallet-errors.test.ts test/unit/bridge-inputs.test.ts test/unit/metrics.test.ts` failed as expected:
  - `BridgeFeeNotice.vue` had verbose inline fee details and no tooltip icon/tooltip content.
  - Reset changed the selected scenario back to `happy-path` and did not invoke the Sim Refresh recovery callback.
  - first-withdrawal-too-small debug/user-facing copy still used `2.4 MINA` instead of the `2.2 MINA` formula.
  - `sendMetric` could not be explicitly tested for production-host sends, proving the local/mock-backend skip was not narrowly injectable.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-fees.test.ts test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/wallet-errors.test.ts test/unit/bridge-inputs.test.ts test/unit/metrics.test.ts` passed: 7 files, 70 tests.
- `moon run -f bridge-ui:format-fix` passed and formatted 2 files.
- Re-ran the focused command after formatting: 7 files, 70 tests passed.
- `moon run -f bridge-ui:test` passed: 31 files, 172 tests.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:lint` passed.
- Browser dev-server smoke on `http://127.0.0.1:4300/` with mocked Auro wallet provider and `bridgeDebugMode=mock-backend`:
  - fee help icons exposed tooltip/title text for bridge transaction fees and first-transfer maximum fees.
  - selecting `repro-claim-failure`, seeding a withdrawal, then clicking Reset preserved the selected scenario and cleared visible operation actors without a separate Sim Refresh click.
  - filtered console output had no service-worker registration error, `/metrics` failure, or duplicate actor error.
