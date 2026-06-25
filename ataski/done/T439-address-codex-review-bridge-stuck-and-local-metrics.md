---
id: T439
title: "Address Codex review bridge stuck and local metrics"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-25T12:28:43Z
updated_at: 2026-06-25T12:33:27Z
---

## Requirements

- Address Codex review finding P2: if the initial send transaction fails before a bridge operation is submitted, such as a wallet rejection or pre-submit wallet/signature failure, the bridge UI must not remain stuck with that failed operation as `activeOperation`.
- Preserve visible backend failures that matter to users, including terminal first-withdrawal-too-small and claim/finalize failures, so those operations still render a failed card and do not get removed before the UI can show feedback.
- Address Codex review finding P3: local metrics suppression must also cover browser localhost hostnames reported as bracketed IPv6, such as `[::1]`.
- Keep production metrics behavior unchanged.

## Test Plan

- BDD.
- RED: add failing bridge operation/bridge machine coverage proving a pre-submit wallet rejection releases the active operation, and add failing metrics coverage for bracketed IPv6 localhost suppression.
- GREEN: implement the release path only for pre-submit/local send failures and normalize local metric hostnames, then rerun focused tests, full bridge-ui validation, and Codex review.

## RED Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts test/unit/metrics.test.ts` failed as expected:
  - `shouldSendBridgeMetric({ debugMode: "off", hostname: "[::1]" })` returned `true`.
  - `removes a pre-submit wallet rejection from the active main operation` timed out waiting for `activeOperation === null` and `operations.size === 0` after Auro-style wallet rejection.

## GREEN Evidence

- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts test/unit/metrics.test.ts` passed: 2 files, 11 tests.
- `moon run -f bridge-ui:format-fix` passed and formatted 1 file.
- `moon run -f bridge-ui:test -- test/unit/bridge-refresh-queue.test.ts test/unit/metrics.test.ts test/unit/bridge-operation.test.ts test/unit/wallet-errors.test.ts` passed: 4 files, 55 tests.
- `moon run -f bridge-ui:test` passed: 31 files, 173 tests.
- `moon run -f bridge-ui:typecheck` passed.
- `moon run -f bridge-ui:lint` passed.
