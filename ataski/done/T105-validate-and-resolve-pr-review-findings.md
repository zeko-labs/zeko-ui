---
id: T105
title: "Validate and resolve PR review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T09:57:48Z
updated_at: 2026-03-19T10:19:00Z
---

## Requirements

- Validate each GitHub review finding against the current branch state instead of assuming the comment is correct.
- Fix any real regressions in code.
- For findings that are already safe, outdated, or non-actionable, add a short reply on the PR and resolve the thread where appropriate.
- Ensure every current GitHub review comment on this topic ends up addressed, outdated, or resolved.
- Leave the unrelated tracked `apps/bridge-ui/.sentryclirc` change untouched.

## Test Plan

- BDD.
- RED first: inspect the current implementation and the active PR review threads to confirm which findings still apply.
- GREEN second: run the relevant project checks after fixes, then reply to or resolve each affected GitHub review thread with a short status update.

## RED Evidence

- Queried PR review threads for PR #149 and confirmed three unresolved threads:
  - one outdated thread against the deleted `observability/bridge-metrics/sentry/scripts/generate-audit.ts`
  - one active thread showing `captureBridgeError()` was still incorrectly gated behind `metricsEnabled` in `apps/bridge-ui/machines/debug.ts`
  - one active thread showing `describeBridgeError()` could emit metric labels longer than the `MetricEventSchema` 500-character cap, causing the whole metric to be dropped
- Revalidated the additional pasted findings against current code:
  - `serializeBridgeErrorValue()` circular-reference handling for `Error` objects is safe as written
  - passing non-`Error` objects to `Sentry.captureException()` is intentional and still filtered by `beforeSend`
  - missing optional `sentryContext` in `transaction.ts` / `bridge.ts` is not a correctness bug
  - global regexes in `observability/bridge-metrics/lib/sql.ts` are only used with `.replace()` and are safe

## GREEN Evidence

- Added a metric-safe label helper in `apps/bridge-ui/app/telemetry/bridgeErrors.ts` and used it in both `apps/bridge-ui/machines/debug.ts` and `apps/bridge-ui/machines/bridgeOperation.ts`
- Moved `captureBridgeError()` out of the `metricsEnabled` block in `apps/bridge-ui/machines/debug.ts` so handled failures always report to Sentry
- Added focused regression coverage in `apps/bridge-ui/test/unit/bridge-sentry.test.ts` and `apps/bridge-ui/test/unit/debug.test.ts`
- Passed: `pnpm --dir apps/bridge-ui exec vitest run test/unit/bridge-sentry.test.ts test/unit/debug.test.ts`
- Blocked by pre-existing unrelated workspace issue: `pnpm --dir apps/bridge-ui exec nuxt typecheck` fails because `@zeko-labs/bridge-sdk` is unresolved in `machines/helpers.ts` and `machines/operations.worker.ts`
- Added two PR comments summarizing the outcome for the resolved findings because this account could resolve review threads but did not have permission to post per-thread GraphQL review replies
- Re-queried PR #149 review threads after cleanup and confirmed all three previously open threads are now `isResolved: true`
