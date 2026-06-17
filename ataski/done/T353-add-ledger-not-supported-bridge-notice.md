---
id: T353
title: "Add Ledger not supported bridge notice"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T05:07:35Z
updated_at: 2026-06-17T05:20:00Z
---

## Requirements

- Update the bridge UI message copy to indicate Ledger hardware wallets are not yet supported by Zeko Mainnet.
- If reliable Ledger detection exists in the current wallet integration, use it to conditionally warn. If not, append a clear note to the existing bridge instruction message as requested.
- Required final copy at the end of the existing message: "Note: Ledger hardware wallets are not yet supported by Zeko Mainnet."
- Acceptance criteria: users see the Ledger support limitation in-app before bridging, without removing the existing two-transaction signing explanation.

## Test Plan

- BDD. First add or update a bridge UI test that asserts the bridge instruction copy includes the Ledger not-supported note after the existing signing explanation.
- RED path: run the relevant bridge UI test and capture the missing-copy failure.
- GREEN path: update the copy and rerun bridge UI tests/typecheck.

## RED Evidence

- `moon run bridge-ui:test -f` fails `bridge-ui-copy.test.ts` because `Inputs.vue` does not contain `Note: Ledger hardware wallets are not yet supported by Zeko Mainnet.` after the existing bridge instruction copy.

## GREEN Evidence

- `moon run bridge-ui:test -f` passed: 21 test files, 105 tests, including the Ledger not-supported copy assertion.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
