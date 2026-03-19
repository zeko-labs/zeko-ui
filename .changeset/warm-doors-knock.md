---
"@zeko-labs/bridge-sdk": minor
---

**Breaking:** `canFinalizeDeposit`, `canCancelDeposit`, and `canFinalizeWithdrawal` now return `Promise<{ available: boolean; reason: string | null }>` instead of `Promise<boolean>`.

Move mergeUniqueActions to utils, reorder first-withdrawal guard for early amount check, and fix uncaught InsufficientFirstWithdrawalAmountError in canFinalizeWithdrawal.
