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

## Category C: Network / Backend Errors (TODO)

| Linear ID | Error                                       | Resolution                                    | Status |
| --------- | ------------------------------------------- | --------------------------------------------- | ------ |
| WEB-334   | `CombinedError: [Network] Failed to fetch`  | Needs urql error handling investigation       | todo   |
| WEB-346   | `CombinedError: [GraphQL] Unexpected error` | Backend error after retries                   | todo   |
| WEB-276   | `TypeError: Load failed`                    | Needs investigation — likely fetch/asset load | todo   |
| WEB-317   | `Unexpected end of input`                   | Truncated JSON response                       | todo   |
| WEB-204   | `Error getting account data`                | Network-dependent account fetch               | todo   |

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

| Linear ID | Error                                                     | Resolution                                | Status   |
| --------- | --------------------------------------------------------- | ----------------------------------------- | -------- |
| WEB-184   | User rejecting the request (Auro)                         | Wrap as QuietError in signTransaction     | fixed    |
| WEB-291   | `connection declined`                                     | Wallet connection refused → QuietError    | fixed    |
| WEB-290   | `Failed to connect to MetaMask`                           | Filter: MetaMask not relevant to Mina     | filtered |
| WEB-189   | `Attempting to use a disconnected port object`            | Filter: browser extension port disconnect | filtered |
| WEB-197   | `registeredMessage[id].resolve` is undefined              | Wallet messaging race condition           | todo     |
| WEB-154   | `Cannot read properties of undefined (reading 'resolve')` | Same pattern as WEB-197                   | todo     |
| WEB-206   | `Error invoking post: Method not found`                   | Wallet RPC method mismatch                | todo     |

## Category G: iOS / WKWebView (TODO)

| Linear ID | Error                                                          | Resolution                                  | Status   |
| --------- | -------------------------------------------------------------- | ------------------------------------------- | -------- |
| WEB-270   | `no messageHandlers`                                           | iOS WKWebView — needs support investigation | todo     |
| WEB-268   | `WKWebView API client did not respond`                         | Same as WEB-270                             | todo     |
| WEB-273   | `Failed to send message to background script after 3 attempts` | Filter: Auro extension internal error       | filtered |

## Category H: Application Errors (TODO)

| Linear ID | Error                                                      | Resolution                                     | Status |
| --------- | ---------------------------------------------------------- | ---------------------------------------------- | ------ |
| WEB-333   | `Invalid actions data`                                     | bridge-sdk validation boundary                 | todo   |
| WEB-341   | `Invalid witnesses data`                                   | bridge-sdk validation boundary                 | todo   |
| WEB-340   | `Invalid commit ase past withdrawal delay data`            | bridge-sdk validation boundary                 | todo   |
| WEB-258   | `Invalid runtime config`                                   | Runtime config validation                      | todo   |
| WEB-362   | `fromBase58Check: invalid checksum`                        | Validate address before PublicKey.fromBase58() | fixed  |
| WEB-118   | `Cannot assign to read only property 'toString' of Sha256` | o1js internal — needs investigation            | todo   |
| WEB-344   | `rangeCheck32: expected field to fit in 32 bits`           | o1js constraint violation                      | todo   |
| WEB-307   | `Reflect.getMetadata is not a function`                    | Missing polyfill investigation                 | todo   |
| WEB-251   | `Object.groupBy is not a function`                         | Browser compat investigation                   | todo   |
| WEB-129   | `Actor with system ID already exists`                      | XState duplicate actor spawn                   | todo   |
| WEB-323   | `Failed to read 'localStorage'`                            | Privacy/incognito mode                         | todo   |
| WEB-388   | `NotAllowedError: play method not allowed`                 | Autoplay policy investigation                  | todo   |
| WEB-356   | `<unknown>`                                                | Needs sentry-cli investigation                 | todo   |
| WEB-256   | `<unknown>`                                                | Needs sentry-cli investigation                 | todo   |
