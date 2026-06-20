---
id: T383
title: "Bridge UI debug panel"
status: done
blockedBy: [T381]
owner: codex
created_at: 2026-06-18T22:00:49Z
updated_at: 2026-06-18T22:17:05Z
---

## Requirements

- Add a debug-only bridge UI panel/drawer that is rendered only when bridge backend debug mode is active.
- The panel must expose more state than the normal UI, including wallet address/network, bridge source/destination, current operations, lanes, statuses, active operation IDs, selected scenario, mock worker call log, signature requests, signed-command receipt status, fake transaction hashes, simulated slot, and seeded pending operation state.
- Add controls for scenario selection, resetting mock backend state, seeding recovered deposits/withdrawals, advancing pending status, forcing the next worker call to fail, forcing a fee-too-low retry, toggling cancellable deposits, clearing logs, and exporting a JSON debug snapshot.
- Follow existing bridge UI styling conventions and use plain CSS with scoped Vue styles.
- Do not expose the panel in non-debug mode.

## Test Plan

- BDD/TDD: add component/store-level tests that fail until the panel is hidden outside debug mode, shown in debug mode, renders key debug state, and mutates the mock scenario state through controls.
- GREEN target: focused debug panel tests, `moon run bridge-ui:test -f`, and `moon run bridge-ui:typecheck -f`.

## RED Evidence

- `moon run bridge-ui:test -f -- test/unit/debug-panel.test.ts` failed as expected because `../../app/components/BridgeDebugPanel.vue?raw` does not exist yet.

## GREEN Evidence

- `moon run bridge-ui:test -f -- test/unit/debug-panel.test.ts` passed: 1 file, 3 tests.
- `moon run bridge-ui:typecheck -f` passed without the Nuxt component-name warning after moving the controller helper out of `app/components`.
- `moon run bridge-ui:test -f` passed: 25 files, 126 tests.
- `moon run bridge-ui:lint -f` passed.
- Playwright smoke against `http://localhost:3090/` with `NUXT_PUBLIC_BRIDGE_DEBUG_MODE=mock-backend` confirmed the debug panel renders without Auro, the scenario control is present, and seeding/advancing debug state updates the panel. Console output only showed the expected no-Auro path plus the existing dev service-worker MIME warning.
