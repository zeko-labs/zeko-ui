---
"@zeko-labs/bridge-sdk": minor
---

Update bridge operation methods to require a transaction signing callback.

This is a breaking API change for SDK consumers: deposit, withdrawal, finalization, and cancellation methods now request wallet signatures through an explicit callback while preparing bridge proofs and executable transactions.
