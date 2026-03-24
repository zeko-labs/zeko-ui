---
"@zeko-labs/bridge-sdk": minor
"@zeko-labs/bridge-cli": minor
---

Improve deposit queue handling across the bridge SDK and CLI.

The SDK now exposes per-deposit `cancellable` state and enforces deposit finalization ordering so later deposits cannot bypass earlier non-cancellable deposits, while still allowing older cancellable deposits to be skipped.

The CLI now follows the same queue rule, preferring cancellation for older skippable deposits and blocking finalization when an earlier non-cancellable deposit still must be resolved.
