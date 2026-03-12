# Bridge AE Error Audit

Generated from `/Users/hebilicious/Downloads/errors.csv`.

## Summary

- Unique tuples: 30
- Should capture: 27
- Should not capture: 3
- Needs repro: 0

## Classification

| Category         | Action                | Label summary                                                                                                                                                                                                                | Occurrences | Expected Sentry    | Current behavior |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------: | ------------------ | ---------------- |
| bridge           | findPendingOperation  | Invalid witnesses data                                                                                                                                                                                                       |         312 | should-capture     | correct          |
| bridge_operation | failed                | unknown error                                                                                                                                                                                                                |          46 | should-not-capture | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          25 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          22 | should-capture     | correct          |
| bridge_operation | submitDeposit         | Cannot start new transaction within another transaction                                                                                                                                                                      |          20 | should-capture     | correct          |
| transaction      | sendSignedTransaction | Transaction failed with errors: - {"statusCode":200,"statusText":"\"File \\\"src/lib/transaction_logic/zkapp_command_logic.ml\\\", line 1954, characters 42-49: [[0,[[\\\"Account_nonce_precondition_unsatisfied\\\"]]]]\""} |          17 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          15 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          15 | should-capture     | correct          |
| transaction      | sendSignedTransaction | Transaction failed with errors: - {"statusCode":500,"statusText":"Unknown Error: {}"}                                                                                                                                        |          14 | should-capture     | correct          |
| transaction      | signTransaction       | [object Object]                                                                                                                                                                                                              |          14 | should-capture     | correct          |
| bridge_operation | failed                | Transaction failed with errors: - {"statusCode":500,"statusText":"Unknown Error: {}"}                                                                                                                                        |          13 | should-not-capture | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          12 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          12 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          12 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          12 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          12 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          12 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |          12 | should-capture     | correct          |
| bridge_operation | failed                | Transaction failed with errors: - {"statusCode":200,"statusText":"\"File \\\"src/lib/transaction_logic/zkapp_command_logic.ml\\\", line 1954, characters 42-49: [[0,[[\\\"Account_nonce_precondition_unsatisfied\\\"]]]]\""} |           9 | should-not-capture | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           9 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           9 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           9 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           9 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           9 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           9 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           9 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           6 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           6 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           6 | should-capture     | correct          |
| bridge_operation | finalizeWithdrawal    | rangeCheckN: expected field to fit in 64 bits, got <bigint>.                                                                                                                                                                 |           6 | should-capture     | correct          |

## bridge / findPendingOperation

- Label summary: `Invalid witnesses data`
- Occurrences: `312`
- Code path: machines/bridge.ts -> actors.findPendingOperations -> act("findPendingOperation")
- Current handling: createLogger.act("findPendingOperation") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Backend proof data failures are real bridge exceptions. They should appear in Sentry with bridge/action context, and the current instrumentation now captures them explicitly before the machine handles the rethrow.

## bridge_operation / failed

- Label summary: `unknown error`
- Occurrences: `46`
- Code path: machines/bridgeOperation.ts -> FAILED entry -> sendMetric({ category: "bridge_operation", action: "failed" })
- Current handling: Bridge operation FAILED emits a synthetic analytics metric row only; it is a rollup event rather than the root exception path.
- Expected Sentry behavior: `should-not-capture`
- Current behavior: `correct`
- Reason: This is a synthetic lifecycle rollup. It should not create its own top-level Sentry issue; the underlying root action error should be captured instead.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `25`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `22`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / submitDeposit

- Label summary: `Cannot start new transaction within another transaction`
- Occurrences: `20`
- Code path: machines/bridgeOperation.ts -> actors.submitDeposit -> act("submitDeposit")
- Current handling: createLogger.act("submitDeposit") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Submit deposit transaction failures are root bridge-operation exceptions and the current code now captures them explicitly in Sentry.

## transaction / sendSignedTransaction

- Label summary: `Transaction failed with errors: - {"statusCode":200,"statusText":"\"File \\\"src/lib/transaction_logic/zkapp_command_logic.ml\\\", line 1954, characters 42-49: [[0,[[\\\"Account_nonce_precondition_unsatisfied\\\"]]]]\""}`
- Occurrences: `17`
- Code path: machines/transaction.ts -> actors.sendSignedTransaction -> act("sendSignedTransaction")
- Current handling: createLogger.act("sendSignedTransaction") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Broadcast failures are root transaction exceptions. The current code captures both nonce-precondition and unknown transport failures as grouped Sentry issues.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `15`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `15`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## transaction / sendSignedTransaction

- Label summary: `Transaction failed with errors: - {"statusCode":500,"statusText":"Unknown Error: {}"}`
- Occurrences: `14`
- Code path: machines/transaction.ts -> actors.sendSignedTransaction -> act("sendSignedTransaction")
- Current handling: createLogger.act("sendSignedTransaction") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Broadcast failures are root transaction exceptions. The current code captures both nonce-precondition and unknown transport failures as grouped Sentry issues.

## transaction / signTransaction

- Label summary: `[object Object]`
- Occurrences: `14`
- Code path: machines/transaction.ts -> actors.signTransaction -> act("signTransaction")
- Current handling: createLogger.act("signTransaction") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Non-Error object failures should preserve structured details so the normal Sentry filters and grouping rules can evaluate the real error. The current code now serializes those objects instead of collapsing them to `[object Object]`.

## bridge_operation / failed

- Label summary: `Transaction failed with errors: - {"statusCode":500,"statusText":"Unknown Error: {}"}`
- Occurrences: `13`
- Code path: machines/bridgeOperation.ts -> FAILED entry -> sendMetric({ category: "bridge_operation", action: "failed" })
- Current handling: Bridge operation FAILED emits a synthetic analytics metric row only; it is a rollup event rather than the root exception path.
- Expected Sentry behavior: `should-not-capture`
- Current behavior: `correct`
- Reason: This is a synthetic lifecycle rollup. It should not create its own top-level Sentry issue; the underlying root action error should be captured instead.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `12`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `12`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `12`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `12`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `12`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `12`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `12`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / failed

- Label summary: `Transaction failed with errors: - {"statusCode":200,"statusText":"\"File \\\"src/lib/transaction_logic/zkapp_command_logic.ml\\\", line 1954, characters 42-49: [[0,[[\\\"Account_nonce_precondition_unsatisfied\\\"]]]]\""}`
- Occurrences: `9`
- Code path: machines/bridgeOperation.ts -> FAILED entry -> sendMetric({ category: "bridge_operation", action: "failed" })
- Current handling: Bridge operation FAILED emits a synthetic analytics metric row only; it is a rollup event rather than the root exception path.
- Expected Sentry behavior: `should-not-capture`
- Current behavior: `correct`
- Reason: This is a synthetic lifecycle rollup. It should not create its own top-level Sentry issue; the underlying root action error should be captured instead.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `9`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `9`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `9`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `9`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `9`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `9`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `9`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `6`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `6`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `6`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.

## bridge_operation / finalizeWithdrawal

- Label summary: `rangeCheckN: expected field to fit in 64 bits, got <bigint>.`
- Occurrences: `6`
- Code path: machines/bridgeOperation.ts -> actors.finalizeWithdrawal -> act("finalizeWithdrawal")
- Current handling: createLogger.act("finalizeWithdrawal") records the metric label, explicitly captures the handled exception in Sentry with bridge context, and then rethrows into the XState onError path.
- Expected Sentry behavior: `should-capture`
- Current behavior: `correct`
- Reason: Withdrawal finalization failures are root operation exceptions. The current instrumentation captures them and normalizes repeated rangeCheck payloads for stable grouping in Sentry.
