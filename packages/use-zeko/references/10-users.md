# Users

Use this file for public end-user workflows.

## Recommended wallet

- Recommend Auro Wallet first.
- Zeko user docs explicitly treat Auro as the default wallet path.
- If the wallet supports custom Mina-compatible networks, the Zeko testnet URL is `https://testnet.zeko.io`.

## Getting started on testnet

1. Install or open Auro Wallet.
2. Select the Zeko network, or add the custom network URL `https://testnet.zeko.io` if needed.
3. Get tMINA from `https://faucet.zeko.io`.
4. Use `https://zekoscan.io` to inspect accounts and transactions.
5. Use `https://bridge.zeko.io` if the user needs to move assets between Mina and Zeko.

## What to tell users first

- Zeko is currently presented to users as a testnet-first environment.
- Mainnet should not be presented as the default user path unless the latest live source confirms it.
- The simplest user stack is Auro + faucet + Zekoscan + bridge UI.

## Explorer guidance

- Use Zekoscan for Zeko accounts and transactions.
- For faucet CLI success responses, expect explorer links under the Zekoscan testnet path.

## When to escalate to builder references

- If the user wants to script bridge operations, use the Bridge SDK in `30-bridge.md`.
- If the user wants raw endpoints or GraphQL access, use `60-networks-and-endpoints.md`.
