---
id: T319
title: "Preserve dashboard state during loading"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T14:11:11Z
updated_at: 2026-06-10T14:13:12Z
---

## Requirements

- Keep the last successful ops dashboard snapshot rendered while a refresh or network switch request is loading.
- Do not clear the snapshot, summary, cards, or header health into unknown/loading during ordinary refreshes.
- For network switches, only swap displayed dashboard data after the requested network snapshot has fully loaded.
- Show a concise loading/transition hint without changing the meaning of the existing health badges.

## Test Plan

- DDD: patch the state transition logic, then validate with typecheck/lint/build and direct source checks for the removed snapshot clearing behavior.

## RED Evidence

- The route watcher currently sets `snapshot.value = null` before the next network status request finishes, which makes all computed dashboard state degrade to empty/unknown while loading.

## GREEN Evidence

- Removed the network watcher snapshot reset, so the last successful dashboard state stays rendered while the next snapshot loads.
- Added pending network/loading labels that sit beside existing health state instead of replacing it.
- `moon run ops-dashboard:test` passed with 9 tests.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:build` passed. Build emitted only existing Browserslist/baseline data age warnings.
