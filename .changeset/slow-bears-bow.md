---
"@zeko-labs/bridge-cli": patch
---

Retry direct deposit submissions when the bridge backend returns recoverable mutation errors.

This keeps `deposit submit --timeout-slots 1` from failing early on transient `No key returned from mutation` and similar proved-forest availability errors.
