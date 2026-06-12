---
id: T318
title: "Update bridge metrics network prefixes"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T20:54:00Z
updated_at: 2026-06-12T20:58:00Z
---

## Requirements

- Update bridge observability route classification so Zeko-M route sources such as `zeko-m:testnet` and `zeko-m:mainnet` classify as withdrawals.
- Keep the generated Grafana dashboard query in sync with the SQL source of truth.
- Do not change bridge runtime behavior.

## Test Plan

- DDD: inspect the existing route-funnel query first to identify the stale `zeko:` prefix, then update the SQL/dashboard artifacts and verify there are no remaining stale route-funnel `startsWith(blob4, 'zeko:')` checks.
- Validate with `git diff --check` and rerun Codex review after the fix.

## RED Evidence

- Codex review reported P2: `apps/bridge-ui/observability/bridge-metrics/analytics-engine/sql/06_route_funnel.sql` and the generated dashboard still classify withdrawals with `startsWith(blob4, 'zeko:')`, which misses `zeko-m:*`.

## GREEN Evidence

- Updated `06_route_funnel.sql` to classify the finite legacy, Zeko-M, and Zeko-E source network IDs as withdrawals.
- Regenerated `bridge-ui.analytics.dashboard.json` with the checked-in dashboard generator.
- `rg "startsWith\\(blob4, 'zeko:'\\)|startsWith\\(blob4, \\\"zeko:\\\"\\)|startswith\\(blob4, 'zeko:'\\)" apps/bridge-ui/observability/bridge-metrics -n || true` returned no matches.
- `git diff --check` passed.
- `pnpm exec dprint check apps/bridge-ui/observability/bridge-metrics/grafana/bridge-ui.analytics.dashboard.json ataski/tasks.md ataski/in-progress/T318-update-bridge-metrics-network-prefixes.md` passed.
