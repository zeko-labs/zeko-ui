---
id: T205
title: "Remove bridge CLI duplication"
status: done
blockedBy: [T203, T204]
owner: codex
created_at: 2026-05-12T23:10:05Z
updated_at: 2026-05-12T23:24:38Z
---

## Requirements

- Remove remaining accidental duplication after the runtime and operation service refactors.
- Consolidate repeated command setup for app paths, stores, loggers, adapter construction, progress output, sleeps, and clocks.
- Keep extraction tied to removing duplication or isolating a real responsibility; do not create files just to move lines around.
- Preserve all existing CLI behavior and package boundary.

## Test Plan

- TDD.
- RED evidence comes from T202 characterization tests and existing behavior tests.
- GREEN path: run `moon run bridge-cli:test -f`, `moon run bridge-cli:typecheck -f`, and `moon run bridge-cli:lint -f`.

## RED Evidence

- T202-T204 exposed the remaining duplicated setup/logging/retry seams through focused service tests and the existing command behavior suite.

## GREEN Evidence

- `moon run bridge-cli:typecheck -f` passed after consolidating repeated operation command setup for progress logging, sleep, retry delay, and poll interval defaults.
- `moon run bridge-cli:test -f` passed after the setup cleanup.
