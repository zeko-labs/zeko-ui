---
id: T435
title: "Redesign fee and signing copy display"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T09:23:44Z
updated_at: 2026-06-25T09:39:02Z
---

## Requirements

- Fee display must use the selected route, not withdrawal/deposit terminology.
- Show only the fee for the current route selected in the UI.
- Use route language already present in the UI, such as Mina to Zeko and Zeko to Mina.
- Preserve the fee model: static total 0.2 MINA; first Mina to Zeko route can require up to 0.4 MINA total; first Zeko to Mina route can require up to 2.2 MINA total.
- Improve the signing/minimum/Ledger notice so it has natural line breaks and reads cleanly.
- Verify visually in browser for both route directions and responsive layout.

## Test Plan

- BDD.
- RED: update fee and copy tests to fail until only selected-route fee copy is rendered and the signing notice is split into readable lines.
- GREEN: adjust fee view model and markup without adding dependencies.

## RED Evidence

- `moon run bridge-ui:test -- test/unit/debug-panel.test.ts test/unit/mock-backend-worker.test.ts test/unit/bridge-operation.test.ts test/unit/bridge-refresh-queue.test.ts test/unit/bridge-inputs.test.ts test/unit/bridge-fees.test.ts test/unit/bridge-ui-copy.test.ts` failed: `selectedBridgeFeeDisclosure` was missing, `Inputs.vue` still rendered the old fee disclosure, and the signing notice was still a single paragraph without natural ordered-step line breaks.

## GREEN Evidence

- `moon run bridge-ui:format-fix && moon run bridge-ui:test && moon run bridge-ui:typecheck` passed. The full bridge-ui test run covered 29 files and 166 tests.
- `test/unit/bridge-fees.test.ts` verifies selected-route fee disclosure for Mina to Zeko and Zeko to Mina without deposit/withdrawal terminology.
- `test/unit/bridge-ui-copy.test.ts` verifies the signing notice is split into ordered send/claim steps, Ledger copy, and the 2 MINA minimum.
- Browser dev server rendered the app but could not reach the bridge form without an Auro wallet extension in the browser profile.
