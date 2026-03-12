# Bridge Sentry Capture Policy

Use this as an investigation guide, not as a frozen list of known tuples.

## What Should Reach Sentry

- Root bridge exceptions should be captured in Sentry with bridge-specific
  context and stable grouping.
- Examples:
  - `bridge / findPendingOperation / ...`
  - `bridge_operation / finalizeWithdrawal / ...`
  - `bridge_operation / submitDeposit / ...`
  - `transaction / sendSignedTransaction / ...`
  - `transaction / signTransaction / ...`

## What Should Usually Stay In AE

- Synthetic lifecycle rollups such as `bridge_operation / failed / ...`
- These rows summarize failure states and should point back to the captured root
  exception instead of creating their own Sentry issue family.

## What May Be Filtered Intentionally

- `QuietError`
- wallet rejection flows
- browser extension noise
- aborted requests
- third-party-only stack traces

If an AE row falls into one of those categories, verify that the filtering is
intentional before changing instrumentation.

## How To Classify A New Error

1. Is this row a root exception or a synthetic rollup?
2. Which action emitted it?
3. Does `createLogger.act()` capture it through
   `apps/bridge-ui/app/telemetry/bridgeErrors.ts`?
4. Could `apps/bridge-ui/sentry.client.config.ts` be filtering it out on
   purpose?
5. If it is a non-`Error` object, does the label preserve structured detail or
   has it degraded into something unhelpful?

## Files To Inspect

- `apps/bridge-ui/machines/debug.ts`
- `apps/bridge-ui/app/telemetry/bridgeErrors.ts`
- `apps/bridge-ui/sentry.client.config.ts`
- `apps/bridge-ui/machines/bridge.ts`
- `apps/bridge-ui/machines/bridgeOperation.ts`
- `apps/bridge-ui/machines/transaction.ts`
