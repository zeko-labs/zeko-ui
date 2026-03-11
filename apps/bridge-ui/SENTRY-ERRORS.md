# Sentry Error Triage

Tracking document for bridge-ui Sentry issues from Linear Web team triage.

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

## Category C: Network / Backend Errors (Keep in Sentry)

bridge-sdk retries 5x via urql `retryExchange`. These errors surface only after retries are exhausted. They are real backend/infrastructure signals — if the backend is down or returning bad data, we need to know.

| Linear ID | Error                                       | Resolution                                                           | Status  |
| --------- | ------------------------------------------- | -------------------------------------------------------------------- | ------- |
| WEB-334   | `CombinedError: [Network] Failed to fetch`  | Keep: backend outage signal after 5 retries                          | monitor |
| WEB-346   | `CombinedError: [GraphQL] Unexpected error` | Keep: backend bug signal                                             | monitor |
| WEB-276   | `TypeError: Load failed`                    | Keep: could be our assets or fetch calls, needs investigation        | monitor |
| WEB-317   | `Unexpected end of input`                   | Keep: backend returning truncated JSON is a bug                      | monitor |
| WEB-204   | `Error getting account data`                | Keep: network-dependent account fetch failure, infrastructure signal | monitor |

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
| WEB-206   | `Error invoking post: Method not found`                   | Keep: could indicate Auro version incompatibility with our wallet SDK calls   | monitor  |

## Category G: iOS / WKWebView (Filtered)

Bridge does not support iOS embedded browsers (Telegram, Twitter in-app browser). Filtering is appropriate given the conscious decision not to support this platform.

| Linear ID | Error                                                          | Resolution                            | Status   |
| --------- | -------------------------------------------------------------- | ------------------------------------- | -------- |
| WEB-270   | `no messageHandlers`                                           | Filter: iOS WKWebView, not supported  | filtered |
| WEB-268   | `WKWebView API client did not respond`                         | Filter: same as WEB-270               | filtered |
| WEB-273   | `Failed to send message to background script after 3 attempts` | Filter: Auro extension internal error | filtered |

## Category H: Application Errors

| Linear ID | Error                                                      | Resolution                                                                                       | Status   |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| WEB-333   | `Invalid actions data`                                     | Keep: actions API serving corrupted chain data — infrastructure/backend signal                   | monitor  |
| WEB-341   | `Invalid witnesses data`                                   | Keep: same — backend data quality signal                                                         | monitor  |
| WEB-340   | `Invalid commit ase past withdrawal delay data`            | Keep: same — backend data quality signal                                                         | monitor  |
| WEB-258   | `Invalid runtime config`                                   | Keep: deployment configuration broken, must be visible                                           | monitor  |
| WEB-362   | `fromBase58Check: invalid checksum`                        | Fix: `validatePublicKey` wrapper with `{ cause }` in operations.worker.ts                        | fixed    |
| WEB-118   | `Cannot assign to read only property 'toString' of Sha256` | Filter: o1js internal read-only property mutation, not triggered by our code                     | filtered |
| WEB-344   | `rangeCheck32: expected field to fit in 32 bits`           | Keep: invalid data reaching o1js proofs, likely bad backend data or unexpected user input        | monitor  |
| WEB-307   | `Reflect.getMetadata is not a function`                    | Keep: needs investigation — could be missing polyfill a dependency needs                         | monitor  |
| WEB-251   | `Object.groupBy is not a function`                         | Fix: replaced `Object.groupBy` with manual loop in Bridge.vue                                    | fixed    |
| WEB-129   | `Actor with system ID already exists`                      | Fix: guard in bridge.ts `startOperation` to skip spawn if operation already exists               | fixed    |
| WEB-323   | `Failed to read 'localStorage'`                            | Keep: optional chaining exists but still fires — unguarded code path or property access throwing | monitor  |
| WEB-388   | `NotAllowedError: play method not allowed`                 | Filter: background video with muted+playsinline, cosmetic browser policy edge case               | filtered |
| WEB-356   | `<unknown>`                                                | Keep: unidentified errors need sentry-cli investigation before deciding                          | monitor  |
| WEB-256   | `<unknown>`                                                | Keep: same — cannot justify hiding what hasn't been investigated                                 | monitor  |
