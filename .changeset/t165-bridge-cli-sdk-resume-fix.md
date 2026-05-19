---
"@zeko-labs/bridge-cli": minor
"@zeko-labs/bridge-sdk": patch
---

Fix bridge CLI resume/status handling and bridge SDK status edge cases.

The CLI now resumes effectively-finalizable deposits correctly in both the long-running `bridge` flow and the account-wide `operation resume-all` flow, clears queued deposits before submitting a new high-level deposit, preserves resumed deposit targets after finalization changes the indexed status hash, uses SDK finalization indexes to avoid applying withdrawal capability results to the wrong queued item, avoids duplicate finalization submissions while status output lags after a finalization hash, renames `operation resume-user` to `operation resume-all`, honors `--timeout-slots` on both `bridge` and direct `deposit submit`, exposes poll/retry delay controls on long-running bridge commands, reports status endpoints and submit-hash visibility while waiting on withdrawal status progress, retries direct deposit submissions on recoverable backend mutation failures, and normalizes bogus status timestamps before rendering them.

The SDK now normalizes unresolved withdrawal timestamps, treats nullable Actions API commit responses as waiting/non-finalizable status with explicit boolean status fields, reports endpoint URLs in verbose withdrawal action-source diagnostics, reports the selected index from finalization capability checks, and reports a clearer non-finalizable deposit reason when an earlier deposit must be resolved first.
