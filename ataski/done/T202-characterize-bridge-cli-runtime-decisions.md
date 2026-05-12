---
id: T202
title: "Characterize bridge CLI runtime decisions"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-12T23:10:05Z
updated_at: 2026-05-12T23:15:54Z
---

## Requirements

- Add focused characterization coverage before refactoring bridge CLI runtime internals.
- Cover pure domain decisions for deposit and withdrawal flows: submit, wait, finalize, cancel, complete, cancelled, and failure-producing cases where currently represented.
- Cover SDK adapter instrumentation behavior: call traces are recorded through one wrapper path, capability wait reasons are preserved, and non-verbose sessions are left untouched.
- Cover operation status projection and resume-all queue discovery behavior at a service level, not only through the large command-flow tests.
- Preserve all existing behavior and package boundary from PR #173.

## Test Plan

- TDD.
- RED path: add tests that import new internal runtime/service modules that do not exist yet and assert the intended decision/service contracts. `moon run bridge-cli:test -f` must fail because the modules or exported functions are missing.
- GREEN path: implement the runtime/service modules while preserving existing command behavior, then rerun bridge-cli tests.

## RED Evidence

- `moon run bridge-cli:test -f` failed after adding characterization tests:
  - `tests/bridge-runtime-decisions.test.ts` cannot import `../src/core/bridge-runtime/decisions`.
  - `tests/bridge-runtime-instrumentation.test.ts` cannot import `../src/core/bridge-runtime/instrumentation`.
  - `tests/operation-services.test.ts` cannot import `../src/core/operation-services`.

## GREEN Evidence

- `moon run bridge-cli:test -f` passed after adding the decision, instrumentation, and operation service modules:
  - 21 test files passed.
  - 96 tests passed and 13 skipped.
