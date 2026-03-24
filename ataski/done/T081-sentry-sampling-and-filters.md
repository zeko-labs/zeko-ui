---
id: T081
title: "Sentry sampling rates and error filters"
status: todo
blockedBy: []
owner: unassigned
created_at: 2026-03-12T00:00:00Z
updated_at: 2026-03-12T00:00:00Z
---

## Requirements

Modify `apps/bridge-ui/sentry.client.config.ts`:

### Sampling Rates

- `tracesSampleRate`: 1.0 → 0.05
- `profilesSampleRate`: 1.0 → 0.05
- Keep `replaysOnErrorSampleRate` at 1.0 and `replaysSessionSampleRate` at 0

### Error Filters — `ignoreErrors`

Add patterns for Category A (third-party extensions) and Category D (user navigation):

- `zaloJSV2 is not defined` (WEB-294)
- `window.misesEthereum` (WEB-275)
- `SecurityError: Blocked a frame` (WEB-281)
- `Error: no ad` (WEB-288)
- `TypeError: Illegal invocation` (WEB-168)
- `Invalid property descriptor. Cannot both specify accessors` (WEB-298)
- `AbortError: The user aborted a request` (WEB-252)
- `Failed to connect to MetaMask` (WEB-290)
- `Attempting to use a disconnected port object` (WEB-189)
- `Failed to send message to background script` (WEB-273)

### `beforeSend` enhancement

In the existing `beforeSend`, add filtering for third-party tagged errors from `thirdPartyErrorFilterIntegration`.

## Test Plan

Test Strategy Exception: Sentry SDK config changes cannot be meaningfully unit tested — they are runtime SDK initialization options. GREEN evidence is a successful build + typecheck.

## RED Evidence

## GREEN Evidence
