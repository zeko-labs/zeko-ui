# Bridge Sentry Capture Policy

## Intended Outcome

- Root bridge exceptions should be captured in Sentry with bridge-specific
  context and stable grouping.
- Synthetic lifecycle metrics such as `bridge_operation / failed / ...` should
  remain AE-only rollups and should not open separate top-level Sentry issues.
- Existing intentional filters remain intact for:
  - `QuietError`
  - wallet rejection flows
  - browser extension noise
  - aborted requests
  - third-party-only stack traces

## AE Rows That Should Become Sentry Issues

- `bridge / findPendingOperation / Invalid witnesses data`
- `bridge_operation / finalizeWithdrawal / rangeCheckN...`
- `bridge_operation / submitDeposit / Cannot start new transaction within another transaction`
- `transaction / sendSignedTransaction / Account_nonce_precondition_unsatisfied...`
- `transaction / sendSignedTransaction / Unknown Error: {}`
- `transaction / signTransaction / [object Object]`

## AE Rows That Should Not Become Standalone Sentry Issues

- `bridge_operation / failed / unknown error`
- `bridge_operation / failed / <root cause label>`

Those rows are synthetic bridge-operation rollups. They should point back to a
captured root exception instead of becoming their own issue family.

## Non-Error Object Failures

- Non-Error thrown objects must be serialized into a stable string for both AE
  metrics and Sentry capture.
- They should never collapse to `[object Object]`, because that hides the actual
  failure shape and prevents the existing filters from making the right decision.
