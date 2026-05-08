---
"@zeko-labs/bridge-sdk": minor
"@zeko-labs/graphql": minor
---

Update bridge operation methods to require a transaction signing callback.

This is a breaking API change for SDK consumers: deposit, withdrawal, finalization, and cancellation methods now request wallet signatures through an explicit callback while preparing bridge proofs and executable transactions.

The Zeko GraphQL package now exposes the updated bridge schema, bridge fee fields, proving result query, and signed transferrer inputs used by deposit and withdrawal requests.
