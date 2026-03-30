---
id: T159
title: "Validate review findings and simplify bridge-ui error capture"
status: done
blockedBy:
  - T158
owner: codex
created_at: 2026-03-30T03:32:59Z
updated_at: 2026-03-30T03:40:38Z
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

- The merged branch still defines the date column with `accessorKey: "date"` even though the row shape only exposes `dateLabel`, so the table accessor contract is currently broken for that column.
- `captureAppRootError` still deduplicates only object errors via `WeakSet`, so repeated primitive throws would still fan out into duplicate Sentry events.
- The client plugin still installs global listeners unconditionally, which is harmless in production but can duplicate listeners during HMR.
- `beforeSendBridgeUiEvent` currently drops wallet-like plain-object rejections based on `message` alone, which is broader than the previous `{ code, message }` guard and should be narrowed back unless validation proves the expansion is required.

## GREEN Evidence

- Extracted the bridge operations table column config into `app/components/bridgeOperationsTable.ts`, which fixes the stale `"date"` accessor by defining a `date` column that reads from `dateLabel` and simplifies the component.
- Simplified `captureAppRootError` so it deduplicates both object and primitive errors, preventing repeated primitive throws from generating duplicate Sentry captures.
- Made the Nuxt client plugin install the Vue handler and global listeners only once per browser session, which avoids HMR listener duplication without needing teardown logic.
- Restored the original `{ code, message }` guard for wallet-rejection plain objects in `beforeSendBridgeUiEvent` while keeping the intentional `app_originated=true` third-party-filter behavior unchanged.
- `vitest run test/unit/bridge-operations-table.test.ts test/unit/app-root-errors.test.ts test/unit/sentry-client-config.test.ts --config vitest.config.ts` passes with the new column accessor, primitive dedup, and wallet-object guard coverage green.
