---
"@zeko-labs/bridge-cli": minor
"@zeko-labs/bridge-sdk": patch
---

Unblock deposit resume/finalize flows when finalization is already available but local queue analysis has not resolved a claimable index yet.

The CLI now uses that effective claimable index consistently in both the long-running `bridge` flow and `operation resume-all`, and the account-wide resume command has been renamed from `resume-user` to `resume-all` to match its actual behavior.

The SDK now reports a more accurate reason when a deposit is not finalizable yet because bridge state has not advanced far enough.
