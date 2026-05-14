---
id: T204
title: "Improve bridge status endpoint logging"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-12T22:39:23Z
updated_at: 2026-05-12T22:48:10Z
---

## Requirements

- Make bridge CLI/SDK verbose diagnostics clearly report which configured endpoints are queried while waiting for withdrawal submission/finalization.
- Include per-source withdrawal action counts and whether the current operation submit hash is visible when the CLI reports a waiting state.
- Preserve current behavior; this task is observability-only.
- Avoid leaking secrets. Endpoint URLs and public transaction hashes are safe to report.

## Test Plan

- TDD: add targeted tests for withdrawal wait diagnostics before implementation where feasible, then validate bridge CLI tests and typecheck.

## RED Evidence

- Current CLI output only reports generic `waiting-for-submission` / `waiting-finalization` plus SDK counts like `archiveCount` and `liveCount`; it does not name the endpoint URLs or say whether the current submit hash was observed in each source.

## GREEN Evidence

- `moon run bridge-cli:test -f -- tests/bridge-flow.test.ts -t "reports withdrawal status endpoints"`: passed.
- `moon run bridge-cli:typecheck -f`: passed.
- `moon run bridge-cli:test -f`: passed, 76 passed and 13 skipped.
- `moon run bridge-sdk:typecheck -f`: passed.
- `moon run bridge-sdk:test -f`: passed, 33 passed.
- `moon run bridge-cli:build -f`: passed.
- `git diff --check`: passed.
