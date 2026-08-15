---
"@zeko-labs/graphql": patch
"@zeko-labs/bridge-sdk": patch
---

Allow bridge runtimes to connect to sequencers that expose the universal Ethereum asset registry without the legacy single-token config field, accept the gateway's explicit native action encoding version, and index pending registry events from the live sequencer GraphQL API. Re-authenticate the live end-to-end client after each registry append, deploy its token mirror, and coordinate the required commit before registering the next asset. Refresh the remote fee-payer nonce between each mirror deployment transaction.
