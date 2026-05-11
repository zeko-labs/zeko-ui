---
"@zeko-labs/bridge-cli": minor
"@zeko-labs/bridge-sdk": patch
---

Fix standalone bridge CLI and SDK recovery and status bugs.

The CLI now resumes effectively-finalizable deposits correctly in both the long-running `bridge` flow and the account-wide `operation resume-all` flow, renames `resume-user` to `resume-all`, honors `--timeout-slots` on both `bridge` and direct `deposit submit`, retries direct deposit submissions on recoverable backend mutation failures, and normalizes bogus status timestamps before rendering them.

The SDK now normalizes unresolved withdrawal timestamps, treats nullable Actions API commit responses as waiting/non-finalizable status, and reports a clearer non-finalizable deposit reason when an earlier deposit must be resolved first.
