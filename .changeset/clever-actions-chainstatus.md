---
"@zeko-labs/graphql": patch
---

Add `chainStatus` to the mina-archive `fetchActions` query `blockInfo` selection. This lets consumers distinguish canonical/pending live-chain blocks from orphaned dead-fork blocks that the archive can return when its database holds more than one chain instance. The field is additive and does not change existing consumers.
