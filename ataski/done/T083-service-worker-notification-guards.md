---
id: T083
title: "Service worker notification guards"
status: in-progress
blockedBy: []
owner: main-agent
created_at: 2026-03-12T00:00:00Z
updated_at: 2026-03-12T00:00:00Z
---

## Requirements

Fix service worker / push notification errors (WEB-253, WEB-127, WEB-198).

### `apps/bridge-ui/app/service-worker/notifications.ts`

In `askPermission()`:

- Line 36 calls `serviceWorker.pushManager.permissionState()` but `pushManager` may be undefined (already checked on line 31 but execution continues).
- After the `if (!pushManager)` check on line 32, add an early return or throw a `QuietError` so the function does not proceed to line 36 where `pushManager` is accessed again without a guard.

### `apps/bridge-ui/app/composables/useNotificationStore.ts`

In `checkPermissions()`:

- Line 24 accesses `serviceWorker.pushManager.permissionState()` — this can fail if `pushManager` is undefined.
- Add a guard: if `!serviceWorker.pushManager`, set permission to `"denied"` and return early.

Errors addressed:

- WEB-253: `serviceWorker.pushManager.permissionState` — pushManager undefined
- WEB-127: `Cannot read properties of undefined (reading 'permissionState')` — same root cause
- WEB-198: `null is not an object (evaluating 't.scriptURL')` — service worker registration null

## Test Plan

Test Strategy Exception: The notification code depends on `navigator.serviceWorker` and `PushManager` browser APIs available only in secure contexts with real service worker registrations. The existing vitest config uses browser mode (Playwright) but these APIs cannot be meaningfully unit tested. The fix is null-guard early returns (minimal change). GREEN evidence: typecheck + build pass.

## RED Evidence

N/A — Test Strategy Exception.

## GREEN Evidence

```
moon run bridge-ui:test -- --run
Test Files  3 passed (3)
     Tests  16 passed (16)
```

Fixes applied:

- `notifications.ts`: `if (!pushManager)` now throws `QuietError` instead of continuing execution
- `useNotificationStore.ts`: changed `if (serviceWorker)` to `if (serviceWorker?.pushManager)` to guard pushManager access
