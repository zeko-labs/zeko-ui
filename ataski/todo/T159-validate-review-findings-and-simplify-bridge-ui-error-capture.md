---
id: T159
title: "Validate review findings and simplify bridge-ui error capture"
status: todo
blockedBy:
  - T158
owner: unassigned
created_at: 2026-03-30T03:32:59Z
updated_at: 2026-03-30T03:32:59Z
---

## Requirements

- Validate each reported review finding against the merged branch state instead of assuming it is correct.
- Fix the legitimate issues:
  - align the bridge operations date column with the refactored row shape
  - simplify the root-error capture code while preserving intended behavior
- Do not revert intentional behavior that is already covered by tests unless validation proves it is incorrect.
- Keep the Sentry filtering behavior explicit and easy to read.

## Test Plan

- TDD.
- RED first: reproduce the legitimate review issues with focused tests or direct failing behavior in the merged branch.
- GREEN second: implement the smallest simplification and correctness fixes that satisfy those checks.

## RED Evidence

## GREEN Evidence
