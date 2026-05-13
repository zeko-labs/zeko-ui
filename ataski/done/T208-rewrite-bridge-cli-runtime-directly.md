---
id: T208
title: "rewrite-bridge-cli-runtime-directly"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-12T23:58:54Z
updated_at: 2026-05-13T00:09:30Z
---

## Requirements

- Rewrite the CLI-owned bridge runtime toward the most direct implementation possible while preserving end-user CLI behavior.
- Keep `packages/bridge-sdk` untouched.
- Remove accidental CLI layers that duplicate simple session state transitions or SDK call orchestration.
- Preserve public flags, JSON output, persisted session shape, package boundary, retry behavior, verbose diagnostics, resume/status behavior, and command behavior.
- Do not split files or introduce abstractions as a line-count exercise; only keep boundaries that directly map to reusable command plumbing or stable domain helpers.

## Test Plan

- DDD: use the user's review feedback as the design driver, then verify the resulting behavior through the existing bridge-cli behavioral suite and package-boundary checks.
- Run `moon run bridge-cli:typecheck -f`, `moon run bridge-cli:test -f`, `moon run bridge-cli:lint -f`, and `moon run bridge-cli:build -f`.
- Confirm `packages/bridge-sdk` has no diff.

## RED Evidence

- User review on 2026-05-13 rejected the conservative refactor as missing the point and requested the CLI internals be rewritten directly while preserving end-user behavior.

## GREEN Evidence

- Removed the CLI-owned xstate operation machine and the `xstate` dependency from `@zeko-labs/bridge-cli`.
- Replaced the xstate phase reducer with a small explicit CLI transition table.
- Collapsed the synthetic instrumented adapter wrapper into direct SDK calls inside the retry path; verbose diagnostics are recorded as session decoration instead of through a fake adapter object.
- Deleted the operation-machine test and rewrote diagnostics tests against the remaining direct helpers.
- Verified `packages/bridge-sdk` has no diff.
- Validation passed:
  - `moon run bridge-cli:typecheck -f`
  - `moon run bridge-cli:test -f`
  - `moon run bridge-cli:lint -f`
  - `moon run bridge-cli:build -f`
