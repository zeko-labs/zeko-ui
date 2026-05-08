---
id: T168
title: "Route SDK signing through transaction machine"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-06T18:35:06Z
updated_at: 2026-05-06T18:39:15Z
---

## Requirements

- Replace the direct bridge operation SDK signing helper with a transaction-machine-owned signing path.
- Keep SDK worker methods accepting a thin signing callback, but make the main-thread implementation of that callback run the transaction machine in sign-only mode.
- Preserve the existing send-and-confirm transaction-machine flow for the final serialized transaction returned by the SDK.
- Keep the worker boundary focused on SDK adaptation only.

## Test Plan

- TDD: use the existing failing-review condition as the RED path: the current UI implementation signs SDK transactions through a direct helper instead of the transaction machine.
- GREEN requires bridge UI typecheck and tests to pass after the signing callback is refactored to use a sign-only transaction-machine mode.

## RED Evidence

- Review feedback identified the direct `signZkappTransaction` callback in `bridgeOperation.ts` as the wrong integration boundary because it bypasses the transaction machine.

## GREEN Evidence

- `pnpm exec moon run bridge-ui:lint-fix -f` passes and fixed one file.
- `pnpm exec moon run :format-all-fix -f` passes and formatted one file.
- `pnpm exec moon run bridge-ui:typecheck -f` passes.
- `pnpm exec moon run bridge-ui:test -f` passes: 11 files, 53 tests.
