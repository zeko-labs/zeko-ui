---
"@zeko-labs/bridge-sdk": patch
"@zeko-labs/bridge-cli": patch
---

Preserve withdrawal action indexes while status witnesses are still catching up so long-running bridge commands can keep tracking submitted withdrawals. Mark unwitnessed withdrawals finalised when the helper account has advanced past their index. Use the dedicated testnet Actions API endpoint so testnet bridge validation can resolve deposit and withdrawal witnesses.
