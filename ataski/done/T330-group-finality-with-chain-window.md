---
id: T330
title: "Group finality with chain window"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T09:05:35Z
updated_at: 2026-06-12T09:07:24Z
---

## Requirements

- Remove L1/L2 finality cards from the top-level dashboard summary grid.
- Keep finality/window information grouped with the relevant L1/L2 chain status so it explains the actual indexing window in context.
- Preserve the health summary counts and status logic without making finality appear as a primary problem signal.
- Validate the ops dashboard after the UI hierarchy change.

## Test Plan

- DDD: confirm the current template renders finality as standalone top-level summary tiles and repeats it inside chain rows.
- Update the template so finality appears only inside the chain/window section.
- Validate with `moon run -f ops-dashboard:test`, `moon run -f ops-dashboard:typecheck`, and `moon run -f ops-dashboard:lint`.

## RED Evidence

- `rg` showed top-level `SummaryTile` rendering for `${row.id}-finality-gap` plus separate per-chain finality rendering inside `ChainBand`, causing duplicated and over-weighted finality information.

## GREEN Evidence

- Removed finality from `dashboardCheckStates`, so headline OK/Warn/Error/Unknown counts no longer include non-actionable finality windows.
- Removed top-level finality `InsightCard` rendering from the operational gaps grid.
- Kept finality in each chain header badge, next to that chain's coverage and archive/daemon state.
- Changed the operational gaps grid to 3 desktop columns so the remaining paired L1/L2 signals align as coverage, DB tail, and archive/daemon.
- `moon run -f ops-dashboard:test` passed: 14 tests.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed, with only existing dependency freshness warnings for browser compatibility data.
