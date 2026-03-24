---
id: T101
title: "Add instance-bound Grafana dashboard output"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T09:00:51Z
updated_at: 2026-03-19T09:03:54Z
---

## Requirements

- Add a deterministic dashboard generation path that binds every panel and target to an explicit Grafana datasource UID and type.
- Keep the existing portable import artifact, but also support an instance-ready artifact that does not depend on the import UI datasource picker.
- Document how to generate and use the instance-bound artifact.

## Test Plan

- BDD.
- RED first: confirm the current import flow still depends on Grafana matching a datasource through `__inputs`.
- GREEN second: generate an instance-bound dashboard artifact with explicit datasource references and verify the JSON no longer contains `__inputs` placeholders for panel queries.

## RED Evidence

- The portable dashboard import still depended on Grafana resolving the datasource via `__inputs` and the import-time picker.
- Even after fixing the plugin name, that path could still fail if Grafana refused to map the datasource during import.

## GREEN Evidence

- Extended `generate-dashboard.ts` so `--datasource-uid` and `--datasource-type` produce an instance-bound dashboard artifact.
- Verified a generated bound dashboard contains no `__inputs` block and uses explicit datasource objects like:
  `{ "type": "grafana-clickhouse-datasource", "uid": "test-clickhouse-uid" }`
  on panels and query targets.
- Documented the guaranteed path and how to find the datasource UID in Grafana in `grafana/README.md`.
