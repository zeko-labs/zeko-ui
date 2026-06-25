---
id: T448
title: "Fix route minimum copy and validation"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T16:56:18Z
updated_at: 2026-06-25T16:59:20Z
---

## Requirements

- Mina -> Zeko must validate against a 3 MINA minimum.
- Zeko -> Mina must validate against a 5 MINA minimum.
- The visible fee/minimum line must be route-specific bridge-minimum copy only:
  - `Mina -> Zeko bridge minimum 3 MINA`
  - `Zeko -> Mina bridge minimum 5 MINA`
- Do not display a separate visible `fee X MINA` label next to the bridge minimum.
- Keep the existing native `title` details button for verbose fee details.

## Test Plan

- BDD: update bridge input and fee-copy unit tests so the current inverted thresholds and visible fee copy fail before implementation.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` fails before implementation:
  - Mina -> Zeko minimum still returns `5` instead of `3`.
  - Fee disclosure still lacks `bridgeMinimumLabel`.
  - `BridgeFeeNotice.vue` still renders `Bridge Minimum {{ fees.minimumAmountMina }} MINA` plus `{{ fees.routeFeeLabel }}`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts` passed: 2 files, 7 tests.
- `moon run -f bridge-ui:format-fix && moon run -f bridge-ui:test && moon run -f bridge-ui:typecheck && moon run -f bridge-ui:lint && git diff --check` passed.
- Full `bridge-ui:test` passed: 31 files, 183 tests.
