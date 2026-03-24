# Sentry Error Triage

Tracking document for bridge-ui Sentry issues from Linear Web team triage.

> Last reconciled with Linear Web Triage: 2026-03-12. All Sentry-related issues moved to Done.

## Category A: Third-party Extension Noise (Filtered)

Not our code. Zero signal. Safe to filter.

| Linear ID | Error                                                        | Resolution                            | Status   |
| --------- | ------------------------------------------------------------ | ------------------------------------- | -------- |
| WEB-294   | `zaloJSV2 is not defined`                                    | Filter: Zalo browser extension        | filtered |
| WEB-275   | `window.misesEthereum.selectedAddress`                       | Filter: Mises wallet extension        | filtered |
| WEB-281   | `SecurityError: Blocked a frame`                             | Filter: cross-origin extension iframe | filtered |
| WEB-288   | `Error: no ad`                                               | Filter: ad script                     | filtered |
| WEB-168   | `TypeError: Illegal invocation`                              | Filter: generic extension             | filtered |
| WEB-298   | `Invalid property descriptor. Cannot both specify accessors` | Filter: browser extension compat      | filtered |

## Category B: Service Worker / Notifications (Fixed)

| Linear ID | Error                                                             | Resolution                                       | Status |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------ | ------ |
| WEB-253   | `serviceWorker.pushManager.permissionState`                       | Guard pushManager access in useNotificationStore | fixed  |
| WEB-127   | `Cannot read properties of undefined (reading 'permissionState')` | Same root cause as WEB-253                       | fixed  |
| WEB-198   | `null is not an object (evaluating 't.scriptURL')`                | Guard service worker registration access         | fixed  |

## Category C: Network / Backend Errors (Fixed)

bridge-sdk retries 5x via urql `retryExchange`. These errors surface only after retries are exhausted. User-friendly messages via `toUserFriendlyMessage` in `errors.ts`. Kept in Sentry — will resurface if backend issues recur.

| Linear ID | Error                                       | Resolution                                                                        | Status |
| --------- | ------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| WEB-334   | `CombinedError: [Network] Failed to fetch`  | Fix: user sees "bridge service temporarily unreachable" via toUserFriendlyMessage | fixed  |
| WEB-346   | `CombinedError: [GraphQL] Unexpected error` | Fix: user sees "bridge service encountered unexpected error"                      | fixed  |
| WEB-276   | `TypeError: Load failed`                    | Fix: user sees "network request failed"                                           | fixed  |
| WEB-317   | `Unexpected end of input`                   | Fix: user sees "bridge service returned incomplete response"                      | fixed  |
| WEB-204   | `Error getting account data`                | Fix: user sees "could not retrieve account data"                                  | fixed  |

## Category D: User Navigation (Filtered)

| Linear ID | Error                                    | Resolution                  | Status   |
| --------- | ---------------------------------------- | --------------------------- | -------- |
| WEB-252   | `AbortError: The user aborted a request` | Filter: user navigated away | filtered |

## Category E: Stale Deployment Cache (Fixed)

| Linear ID | Error                                               | Resolution                    | Status |
| --------- | --------------------------------------------------- | ----------------------------- | ------ |
| WEB-302   | `[GET] /_nuxt/builds/meta/...json: Failed to fetch` | chunk-reload.client.ts plugin | fixed  |
| WEB-145   | `Failed to fetch dynamically imported module`       | chunk-reload.client.ts plugin | fixed  |
| WEB-180   | `Importing a module script failed`                  | chunk-reload.client.ts plugin | fixed  |

## Category F: Wallet Interaction

| Linear ID | Error                                                     | Resolution                                                                    | Status   |
| --------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- | -------- |
| WEB-184   | User rejecting the request (Auro)                         | Fix: wrap as QuietError in signTransaction                                    | fixed    |
| WEB-291   | `connection declined`                                     | Fix: wallet connection refused → QuietError                                   | fixed    |
| WEB-290   | `Failed to connect to MetaMask`                           | Filter: MetaMask not relevant to Mina bridge                                  | filtered |
| WEB-189   | `Attempting to use a disconnected port object`            | Filter: browser extension port lifecycle, not our code                        | filtered |
| WEB-197   | `registeredMessage[id].resolve` is undefined              | Filter: Auro extension internal messaging race, confirmed not in our codebase | filtered |
| WEB-154   | `Cannot read properties of undefined (reading 'resolve')` | Filter: same Auro internal pattern as WEB-197                                 | filtered |
| WEB-206   | `Error invoking post: Method not found`                   | Fix: catch in signTransaction, user sees "update your Auro Wallet"            | fixed    |

## Category G: iOS / WKWebView (Filtered)

Bridge does not support iOS embedded browsers (Telegram, Twitter in-app browser). Filtering is appropriate given the conscious decision not to support this platform.

| Linear ID | Error                                                          | Resolution                            | Status   |
| --------- | -------------------------------------------------------------- | ------------------------------------- | -------- |
| WEB-270   | `no messageHandlers`                                           | Filter: iOS WKWebView, not supported  | filtered |
| WEB-268   | `WKWebView API client did not respond`                         | Filter: same as WEB-270               | filtered |
| WEB-273   | `Failed to send message to background script after 3 attempts` | Filter: Auro extension internal error | filtered |

## Category H: Application Errors

| Linear ID | Error                                                      | Resolution                                                                                  | Status   |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| WEB-333   | `Invalid actions data`                                     | Fix: user sees "invalid on-chain data, temporary backend issue" via toUserFriendlyMessage   | fixed    |
| WEB-341   | `Invalid witnesses data`                                   | Fix: user sees "invalid proof data, temporary backend issue"                                | fixed    |
| WEB-340   | `Invalid commit ase past withdrawal delay data`            | Fix: user sees "invalid commitment data, temporary backend issue"                           | fixed    |
| WEB-258   | `Invalid runtime config`                                   | Fix: user sees "could not load network configuration"                                       | fixed    |
| WEB-362   | `fromBase58Check: invalid checksum`                        | Fix: `validatePublicKey` wrapper with `{ cause }` in operations.worker.ts                   | fixed    |
| WEB-118   | `Cannot assign to read only property 'toString' of Sha256` | Filter: o1js internal read-only property mutation, not triggered by our code                | filtered |
| WEB-344   | `rangeCheck32: expected field to fit in 32 bits`           | Fix: user sees "out-of-range data from network" via toUserFriendlyMessage                   | fixed    |
| WEB-307   | `Reflect.getMetadata is not a function`                    | Fix: added `reflect-metadata` polyfill import in operations.worker.ts (o1js needs it)       | fixed    |
| WEB-251   | `Object.groupBy is not a function`                         | Fix: replaced `Object.groupBy` with manual loop in Bridge.vue                               | fixed    |
| WEB-129   | `Actor with system ID already exists`                      | Fix: guard in bridge.ts `startOperation` to skip spawn if operation already exists          | fixed    |
| WEB-323   | `Failed to read 'localStorage'`                            | Fix: `safeLocalStorage` try-catch wrapper in debug.ts, `safeSessionStorage` in chunk-reload | fixed    |
| WEB-388   | `NotAllowedError: play method not allowed`                 | Filter: background video with muted+playsinline, cosmetic browser policy edge case          | filtered |
| WEB-356   | `<unknown>` (empty object promise rejection)               | Fix: filter empty-object rejections in `beforeSend` — no keys, no stack, zero signal        | fixed    |
| WEB-256   | `<unknown>` (object with keys: code, message)              | Fix: wallet rejection as plain object — filter in `beforeSend` same as QuietError           | fixed    |
