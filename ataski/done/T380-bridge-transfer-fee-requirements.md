---
id: T380
title: "Bridge transfer fee requirements"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T14:18:52Z
updated_at: 2026-06-19T14:28:20Z
---

## Requirements

- Correct bridge SDK minimum transfer validation for both Mina-to-Zeko deposits and Zeko-to-Mina withdrawals.
- Every transfer amount must cover two bridge proof fees: one for submission and one for finalization.
- The transfer must additionally cover the destination network's account creation fee for each missing destination account:
  - the recipient's default-token account;
  - the recipient's token helper/nullifier account.
- Support all account-existence combinations, requiring zero, one, or two account creation fees.
- Deposits must query destination L2 accounts and use `l2AccountCreationFee`; withdrawals must query destination L1 accounts and use `l1AccountCreationFee`.
- Fail before constructing or signing the submission transaction when the amount is below the calculated requirement.
- Preserve the existing finalization payout deductions: one proof fee and the helper account creation fee when that helper account is new.
- Export a stable SDK error discriminator that consumers can use for either direction.
- Add a changeset for the published bridge SDK package.

## Test Plan

- DDD: encode the fee requirement as a domain calculation driven by recipient/helper account existence.
- RED: add focused unit tests covering 0, 1, and 2 missing destination accounts, the invariant of two proof fees, exact-boundary acceptance, below-boundary rejection, and both deposit/withdrawal direction labels.
- GREEN: implement the shared validation and integrate it into both submission paths.
- Run `moon run bridge-sdk:test -f`, `moon run bridge-sdk:typecheck -f`, and `moon run bridge-sdk:lint -f`.

## RED Evidence

- `pnpm exec moon run bridge-sdk:test -f`
- Result: expected RED. All 9 new fee-domain tests failed because the new calculation, assertion, async account-check, and stable error APIs did not exist; the other 57 bridge SDK tests passed.

## GREEN Evidence

- `pnpm exec moon run bridge-sdk:test -f`: 14 test files and 67 tests passed after formatting.
- `pnpm exec moon run bridge-sdk:typecheck -f`: passed.
- `pnpm exec moon run bridge-sdk:lint -f`: passed with two pre-existing `noExplicitAny` warnings in `src/types.ts`.
- Lefthook passed on commit `766026b`, including repository lint fixes, formatting, and `bridge-ui:typecheck`.
