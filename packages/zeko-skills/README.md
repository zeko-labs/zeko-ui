# Zeko Skills

Public Zeko skills for agents that need to help users bridge assets, get faucet funds, inspect endpoints, run GraphQL and `curl` queries, or build on Zeko.

## Install

Install from [skills.sh](https://skills.sh/) with the `skills` CLI:

```bash
npx skills add https://github.com/zeko-labs/zeko-skills --skill zeko
```

## What You Get

This repository installs one skill:

- `zeko`: agent guidance for real Zeko user and builder workflows

The skill is tuned for:

- ETH and ERC-20 bridging with the Ethereum bridge SDK
- explicitly requested legacy bridge operations with Bridge CLI or Bridge SDK
- faucet flows and testnet funding
- Ethereum and Zeko endpoint selection, with legacy Mina references kept separate
- GraphQL and `curl` examples for live and archive data
- sequencer, archive node, and DA-layer orientation
- zkApp building on Zeko with `o1js` or OCaml

## Example Prompts

- `How do I bridge Sepolia ETH to Zeko?`
- `How do I connect MetaMask and the Zeko Snap?`
- `Which GraphQL endpoints should I use for Zeko live data and archive data?`
- `What is the difference between my Ethereum address and my Zeko address?`
- `I want to build a zkApp on Zeko. What should I read first?`
- `Explain the sequencer, archive node, and DA layer on Zeko.`

## Learn More

- [Zeko docs](https://docs.zeko.io/)
- [Zeko quick start](https://docs.zeko.io/introduction/quick-start)
- [Bridge CLI docs](https://docs.zeko.io/developers/tools/bridge-cli)
- [Bridge SDK docs](https://docs.zeko.io/developers/tools/bridge-sdk)
- [Faucet CLI docs](https://docs.zeko.io/developers/tools/faucet-cli)
- [Skills docs](https://skills.sh/docs)

## Update Or Remove

```bash
npx skills update
npx skills remove zeko
```
