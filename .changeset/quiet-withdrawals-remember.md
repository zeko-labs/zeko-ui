---
"@zeko-labs/bridge-sdk": patch
"@zeko-labs/bridge-cli": patch
---

Preserve withdrawal action indexes while status witnesses are still catching up so long-running bridge commands can keep tracking submitted withdrawals. Mark unwitnessed withdrawals finalised when the helper account has advanced past their index, and exclude pre-V2 withdrawal actions from current queue state so legacy testnet actions do not block new validator runs.
