---
id: T203
title: "Refactor bridge CLI runtime"
status: done
blockedBy: [T202]
owner: codex
created_at: 2026-05-12T23:10:05Z
updated_at: 2026-05-12T23:19:58Z
---

## Requirements

- Refactor the bridge command runtime without changing public CLI behavior, persisted session shape, JSON output, retry behavior, wait behavior, or package boundary.
- Make the long-running bridge flow read as explicit domain decisions: submit, inspect, wait, finalize, cancel, complete, and fail.
- Replace duplicated deposit/withdrawal control flow with explicit strategy or planner differences.
- Move verbose diagnostics into a dedicated adapter instrumentation wrapper so runtime code no longer records SDK calls inline.
- Keep xstate as the runtime orchestrator, but remove repetitive transition boilerplate where a small helper or table makes state movement clearer.
- Do not change `bridge-sdk`.

## Test Plan

- TDD.
- RED evidence comes from T202 characterization tests.
- GREEN path: run `moon run bridge-cli:test -f` and `moon run bridge-cli:typecheck -f` after the runtime refactor.

## RED Evidence

- T202 added focused bridge runtime characterization and initially failed because the decision, instrumentation, and service modules were missing.
- After the modules were introduced, `moon run bridge-cli:test -f` passed and now guards the runtime refactor.

## GREEN Evidence

- `moon run bridge-cli:test -f` passed after routing bridge runtime policy through decision objects and SDK call instrumentation through the shared wrapper.
- `moon run bridge-cli:typecheck -f` passed after the runtime refactor.
