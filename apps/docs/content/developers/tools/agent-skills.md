# Agent Skills

Zeko publishes a public agent skill for assistants that need to help users actually use Zeko.

## Install

Install the public skill from [skills.sh](https://skills.sh/) with the `skills` CLI:

```bash
npx skills add https://github.com/zeko-labs/zeko-skills --skill zeko
```

This installs the `zeko` skill.

## What The Skill Covers

The skill is designed for real Zeko user and builder workflows:

- bridge flows with Bridge CLI or Bridge SDK
- faucet flows and testnet funding
- endpoint discovery for Zeko, Mina gateways, and archive access
- GraphQL and `curl` examples for network inspection and native transfers
- sequencer, archive-node, and DA-layer orientation
- zkApp development on Zeko with `o1js` or OCaml

## Example Uses

- `How do I get tMINA on Zeko-M testnet?`
- `Bridge 2 MINA from Mina to Zeko using the Bridge CLI.`
- `Which endpoints should I use for live data and archive data?`
- `Show me a curl example to send 1.25 MINA from one address to another.`
- `Explain the sequencer, archive node, and DA layer on Zeko.`

## Related Docs

- [Public Zeko skill repo](https://github.com/zeko-labs/zeko-skills)
- [skills.sh CLI docs](https://skills.sh/docs/cli)
- [Bridge CLI](https://docs.zeko.io/developers/tools/bridge-cli)
- [Bridge SDK](https://docs.zeko.io/developers/tools/bridge-sdk)
- [Faucet CLI](https://docs.zeko.io/developers/tools/faucet-cli)
