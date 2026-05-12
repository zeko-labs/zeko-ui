---
id: T204
title: "Refactor operation command services"
status: done
blockedBy: [T202, T203]
owner: codex
created_at: 2026-05-12T23:10:05Z
updated_at: 2026-05-12T23:23:36Z
---

## Requirements

- Refactor `operation` command internals without changing command names, arguments, JSON output, rendered output, persisted sessions, or retry behavior.
- Move status refresh/projection into a focused internal service over persisted session plus current network state.
- Move resume-all discovery and sequential execution into focused internal services.
- Share bridge execution setup between `bridge`, `operation resume`, and `operation resume-all` instead of repeating adapter/store/logger/sleep/now wiring.
- Do not change `bridge-sdk`.

## Test Plan

- TDD.
- RED evidence comes from T202 characterization tests for status projection and resume-all discovery.
- GREEN path: run `moon run bridge-cli:test -f` and `moon run bridge-cli:typecheck -f` after the operation service refactor.

## RED Evidence

- T202 added focused operation service tests for status projection and resume-all queue discovery before the command module delegates to those services.
- The service tests are passing and now guard the command refactor.

## GREEN Evidence

- `moon run bridge-cli:typecheck -f` passed after delegating status projection, resume route parsing, queue discovery, and resumed-session construction to `operation-services`.
- `moon run bridge-cli:test -f` passed with the operation service tests and existing command behavior suite.
