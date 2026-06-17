---
"@zeko-labs/graphql": patch
"@zeko-labs/bridge-sdk": patch
---

Filter Actions API bridge status queries to canonical rows and expose finality metadata. Withdrawal status matching now uses transaction hash plus aux after aux candidate lookup, preventing repeated same-recipient/same-amount withdrawals from being marked completed by an older witness.
