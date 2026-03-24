---
id: T084
title: "Wallet rejection error handling"
status: in-progress
blockedBy: []
owner: main-agent
created_at: 2026-03-12T00:00:00Z
updated_at: 2026-03-12T00:00:00Z
---

## Requirements

Handle wallet interaction errors properly (Category F).

### `apps/bridge-ui/machines/transaction.ts`

In the `signTransaction` actor (line 82-116):

- When `window.mina.sendTransaction()` throws or returns an error due to user rejection, wrap it as `QuietError`.
- Known rejection patterns: error message contains "User reject" or "user reject" or "connection declined".
- Import `QuietError` from `~/errors`.

Errors addressed:

- WEB-184: User rejecting the request (Auro wallet) — user chose to reject, not an app error
- WEB-291: `connection declined` — wallet connection refused by user

### `apps/bridge-ui/machines/operations.worker.ts`

In functions that call `PublicKey.fromBase58()` (lines 49, 129, 150):

- The `account` string comes from the wallet and should be valid, but WEB-362 shows `fromBase58Check: invalid checksum`.
- Add a try-catch around `PublicKey.fromBase58(account)` calls and throw a descriptive error.

Errors addressed:

- WEB-362: `fromBase58Check: invalid checksum` — invalid address format

## Test Plan

TDD — test the `isWalletRejection` helper with vitest.

Test file: `apps/bridge-ui/test/unit/wallet-errors.test.ts`

RED tests:

1. Error containing "User reject" is identified as wallet rejection
2. Error containing "connection declined" is identified as wallet rejection
3. Other errors are not identified as wallet rejection

## RED Evidence

Tests written in `test/unit/wallet-errors.test.ts` — 9 tests covering `isWalletRejection` and `toQuietIfWalletRejection` helper functions.

## GREEN Evidence

```
moon run bridge-ui:test -- --run
Test Files  3 passed (3)
     Tests  16 passed (16)
```

All 9 wallet-errors tests pass. Helper wired into `transaction.ts` signTransaction actor. `validatePublicKey` helper added to `operations.worker.ts`.
