---
"@zeko-labs/bridge-sdk": patch
---

Filter orphaned (dead-fork) blocks out of `fetchActions`. The Mina archive can return blocks from more than one chain instance (for example after an L2 re-genesis that reused the archive database); their actions would otherwise surface as phantom deposits/withdrawals that are not on the live chain. `fetchActions` now selects only canonical/pending blocks via `chainStatus`, protecting both the deposit and withdrawal paths.
