---
"@zeko-labs/bridge-cli": patch
---

Keep the high-level deposit bridge loop waiting when a cancellation capability read fails after retries, while surfacing the failed read as a blocked diagnostic.
