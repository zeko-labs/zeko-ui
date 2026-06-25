---
id: T446
title: "Tighten bridge minimum and fee copy"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T16:18:58Z
updated_at: 2026-06-25T16:29:42Z
---

## Requirements

- Replace the 2 MINA bridge minimum with route-specific minimums: 5 MINA for Mina -> Zeko and 3 MINA for Zeko -> Mina.
- Keep the send button disabled and the amount input invalid only when the entered amount is below the selected route minimum.
- Shrink the signing notice so it takes roughly the previous vertical space: smaller font, tighter line-height, and tighter spacing.
- Include the selected-route fee in the compact notice: "Mina -> Zeko fee 3 MINA" or "Zeko -> Mina fee 5 MINA".
- Collapse the verbose fee notice into a native-title tooltip next to "Bridge minimum X MINA"; do not use custom tooltip CSS or `data-tooltip`.
- Move bridge input and fee helper `.ts` modules out of `app/components`; that directory should contain Vue components.

## Test Plan

- BDD: update unit tests that assert user-visible bridge input behavior and copy so they fail against the current implementation before source edits.
- RED should cover route-specific minimums, compact native-title fee tooltip copy, and the absence of helper `.ts` files in `app/components`.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-view-model.test.ts test/unit/bridge-operations-table.test.ts` fails before implementation:
  - `../../app/utils/bridgeInputs`, `bridgeFees`, `bridgeOperationView`, and `bridgeOperationsTable` cannot resolve because helpers still live under `app/components`.
  - `Inputs.vue` still contains the tall `<ol class="BridgeSteps">` notice.
  - `import.meta.glob("../../app/components/*.ts")` still finds four helper `.ts` files under `app/components`.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts test/unit/bridge-ui-copy.test.ts test/unit/bridge-view-model.test.ts test/unit/bridge-operations-table.test.ts` passed: 5 files, 18 tests.
- `moon run -f bridge-ui:format-fix && moon run -f bridge-ui:test -- test/unit/bridge-fees.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-ui-copy.test.ts && moon run -f bridge-ui:test && moon run -f bridge-ui:typecheck && moon run -f bridge-ui:lint && git diff --check` passed.
- Full `bridge-ui:test` passed: 31 files, 183 tests.
