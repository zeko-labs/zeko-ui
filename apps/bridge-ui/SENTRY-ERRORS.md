# Sentry Error Triage

Tracking document for bridge-ui Sentry issues from Linear Web team triage.

## Category A: Third-party Extension Noise (Filtered in `ignoreErrors`)

| Linear ID | Error                                                        | Resolution                            | Status   |
| --------- | ------------------------------------------------------------ | ------------------------------------- | -------- |
| WEB-294   | `zaloJSV2 is not defined`                                    | Filter: Zalo browser extension        | filtered |
| WEB-275   | `window.misesEthereum.selectedAddress`                       | Filter: Mises wallet extension        | filtered |
| WEB-281   | `SecurityError: Blocked a frame`                             | Filter: cross-origin extension iframe | filtered |
| WEB-288   | `Error: no ad`                                               | Filter: ad script                     | filtered |
| WEB-168   | `TypeError: Illegal invocation`                              | Filter: generic extension             | filtered |
| WEB-298   | `Invalid property descriptor. Cannot both specify accessors` | Filter: browser extension compat      | filtered |

## Category B: Service Worker / Notifications (Code Fix)

| Linear ID | Error                                                             | Resolution                                       | Status |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------ | ------ |
| WEB-253   | `serviceWorker.pushManager.permissionState`                       | Guard pushManager access in useNotificationStore | fixed  |
| WEB-127   | `Cannot read properties of undefined (reading 'permissionState')` | Same root cause as WEB-253                       | fixed  |
| WEB-198   | `null is not an object (evaluating 't.scriptURL')`                | Guard service worker registration access         | fixed  |

## Category C: Network / Backend Errors (Filtered)

bridge-sdk uses urql with `retryExchange` (5 retries, exponential backoff). These errors only surface after all retries are exhausted, meaning the backend is genuinely down. Users cannot take action — filtering prevents quota burn.

| Linear ID | Error                                       | Resolution                                              | Status   |
| --------- | ------------------------------------------- | ------------------------------------------------------- | -------- |
| WEB-334   | `CombinedError: [Network] Failed to fetch`  | Filter: bridge-sdk retries 5x via urql before surfacing | filtered |
| WEB-346   | `CombinedError: [GraphQL] Unexpected error` | Filter: backend error after retries exhausted           | filtered |
| WEB-276   | `TypeError: Load failed`                    | Filter: generic fetch/asset failure, same class         | filtered |
| WEB-317   | `Unexpected end of input`                   | Filter: truncated response from network issues          | filtered |
| WEB-204   | `Error getting account data`                | Filter: network-dependent account fetch after retries   | filtered |

## Category D: User Navigation (Filtered)

| Linear ID | Error                                    | Resolution                  | Status   |
| --------- | ---------------------------------------- | --------------------------- | -------- |
| WEB-252   | `AbortError: The user aborted a request` | Filter: user navigated away | filtered |

## Category E: Stale Deployment Cache (Chunk Reload Plugin)

| Linear ID | Error                                               | Resolution                    | Status |
| --------- | --------------------------------------------------- | ----------------------------- | ------ |
| WEB-302   | `[GET] /_nuxt/builds/meta/...json: Failed to fetch` | chunk-reload.client.ts plugin | fixed  |
| WEB-145   | `Failed to fetch dynamically imported module`       | chunk-reload.client.ts plugin | fixed  |
| WEB-180   | `Importing a module script failed`                  | chunk-reload.client.ts plugin | fixed  |

## Category F: Wallet Interaction

| Linear ID | Error                                                     | Resolution                                                                   | Status   |
| --------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| WEB-184   | User rejecting the request (Auro)                         | Wrap as QuietError in signTransaction                                        | fixed    |
| WEB-291   | `connection declined`                                     | Wallet connection refused → QuietError                                       | fixed    |
| WEB-290   | `Failed to connect to MetaMask`                           | Filter: MetaMask not relevant to Mina                                        | filtered |
| WEB-189   | `Attempting to use a disconnected port object`            | Filter: browser extension port disconnect                                    | filtered |
| WEB-197   | `registeredMessage[id].resolve` is undefined              | Filter: Auro extension internal messaging race — not in our code             | filtered |
| WEB-154   | `Cannot read properties of undefined (reading 'resolve')` | Filter: same Auro internal pattern as WEB-197                                | filtered |
| WEB-206   | `Error invoking post: Method not found`                   | Filter: Auro extension RPC method mismatch — wallet SDK manages this, not us | filtered |

## Category G: iOS / WKWebView (Filtered)

Bridge does not support iOS embedded browsers. These errors come from users opening the site in an iOS app's WKWebView (e.g. Telegram, Twitter in-app browser). Filtering is appropriate.

| Linear ID | Error                                                          | Resolution                            | Status   |
| --------- | -------------------------------------------------------------- | ------------------------------------- | -------- |
| WEB-270   | `no messageHandlers`                                           | Filter: iOS WKWebView, not supported  | filtered |
| WEB-268   | `WKWebView API client did not respond`                         | Filter: same as WEB-270               | filtered |
| WEB-273   | `Failed to send message to background script after 3 attempts` | Filter: Auro extension internal error | filtered |

## Category H: Application Errors

| Linear ID | Error                                                      | Resolution                                                                                         | Status   |
| --------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| WEB-333   | `Invalid actions data`                                     | Filter: bridge-sdk validation of chain data; corrupted data from backend, user cannot fix          | filtered |
| WEB-341   | `Invalid witnesses data`                                   | Filter: same — bridge-sdk validation of chain data                                                 | filtered |
| WEB-340   | `Invalid commit ase past withdrawal delay data`            | Filter: same — bridge-sdk validation of chain data                                                 | filtered |
| WEB-258   | `Invalid runtime config`                                   | Filter: transient SSR/deployment issue, Sentry itself would fail to init                           | filtered |
| WEB-362   | `fromBase58Check: invalid checksum`                        | Fix: `validatePublicKey` wrapper with `{ cause }` in operations.worker.ts                          | fixed    |
| WEB-118   | `Cannot assign to read only property 'toString' of Sha256` | Filter: o1js internal error, not our code                                                          | filtered |
| WEB-344   | `rangeCheck32: expected field to fit in 32 bits`           | Filter: o1js constraint violation from chain data, not actionable                                  | filtered |
| WEB-307   | `Reflect.getMetadata is not a function`                    | Filter: not in our code or direct deps; likely browser extension injecting decorator metadata      | filtered |
| WEB-251   | `Object.groupBy is not a function`                         | Fix: replaced `Object.groupBy` with manual loop in Bridge.vue for browser compat                   | fixed    |
| WEB-129   | `Actor with system ID already exists`                      | Fix: added guard in bridge.ts `startOperation` to skip spawn if operation ID already exists        | fixed    |
| WEB-323   | `Failed to read 'localStorage'`                            | Filter: already guarded with optional chaining in debug.ts; privacy/incognito browser edge case    | filtered |
| WEB-388   | `NotAllowedError: play method not allowed`                 | Filter: background video autoplay with muted+playsinline; browser policy blocks in some edge cases | filtered |
| WEB-356   | `<unknown>`                                                | Filter: cannot identify without Sentry context; unidentifiable errors are noise                    | filtered |
| WEB-256   | `<unknown>`                                                | Filter: same — unidentifiable                                                                      | filtered |
