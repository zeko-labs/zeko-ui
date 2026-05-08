# Bridge Sentry Capture Policy

Use this as an investigation guide, not as a frozen list of known tuples.

## What Should Reach Sentry

- Root bridge exceptions should be captured in Sentry with bridge-specific
  context and stable grouping.
- App-originated root UI errors should also be captured, including Vue render
  failures, `window` `error` events, and `unhandledrejection` events, even when
  generic auto-capture would otherwise classify the stack as third-party-only.
- Examples:
  - `bridge / findPendingOperation / ...`
  - `bridge_operation / finalizeWithdrawal / ...`
  - `bridge_operation / submitDeposit / ...`
  - `transaction / completeSdkSignature / ...`
  - `transaction / signTransaction / ...`
  - `app_root / vue-render / ...`
  - `app_root / window-error / ...`
  - `app_root / unhandledrejection / ...`

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

App-originated events explicitly tagged by the bridge UI should not be dropped
just because `third_party_code` is present; that filter still applies to true
third-party-only noise.

If an AE row falls into one of those categories, verify that the filtering is
intentional before changing instrumentation.

## How To Classify A New Error

1. Is this row a root exception or a synthetic rollup?
2. Which action emitted it?
3. Does `createLogger.act()` capture it through
   `apps/bridge-ui/app/telemetry/bridgeErrors.ts`?
4. Could the app-root capture layer in
   `apps/bridge-ui/app/telemetry/appRootErrors.ts` or the Sentry filter in
   `apps/bridge-ui/sentry.client.config.ts` be affecting it?
5. Could `apps/bridge-ui/sentry.client.config.ts` be filtering it out on
   purpose?
6. If it is a non-`Error` object, does the label preserve structured detail or
   has it degraded into something unhelpful?

## Files To Inspect

- `apps/bridge-ui/machines/debug.ts`
- `apps/bridge-ui/app/telemetry/appRootErrors.ts`
- `apps/bridge-ui/app/telemetry/bridgeErrors.ts`
- `apps/bridge-ui/sentry.client.config.ts`
- `apps/bridge-ui/app/plugins/sentry.client.ts`
- `apps/bridge-ui/machines/bridge.ts`
- `apps/bridge-ui/machines/bridgeOperation.ts`
