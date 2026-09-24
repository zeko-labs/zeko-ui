# Agent Skills

Zeko publishes an installable skill for assistants working with its tools and execution stack.

## Install

Install the public skill from [skills.sh](https://skills.sh/) with the `skills` CLI:

```bash
npx skills add https://github.com/zeko-labs/zeko-skills --skill zeko
```

## Select the right deployment

Tell the assistant whether you are working with the Ethereum-backed Zeko deployment or a legacy Mina-backed network. Existing skill resources include Bridge CLI, faucet, and network-preset examples for the legacy deployment; those commands must not be repurposed for ETH by changing labels.

For Ethereum bridging, use the deployment's Ethereum bridge and `@zeko-labs/eth-bridge-sdk` integration. Preserve `Mina` API names, signing domains, address formats, and other compatibility identifiers when working with the zkApp stack.

## Example uses

- Explain Ethereum deposits, Zeko synchronization, and withdrawal claims.
- Find the sequencer, archive, Actions API, and gateway endpoints in this deployment's configuration.
- Distinguish L2 inclusion from Ethereum settlement in explorer data.
- Build a Zeko zkApp with o1js.
- Identify which commands in an older example are specific to a Mina-backed network.

## Related docs

- [Public Zeko skill repository](https://github.com/zeko-labs/zeko-skills)
- [skills.sh CLI docs](https://skills.sh/docs/cli)
- [Developer Getting Started](../getting-started.md)
- [API Reference](../api-reference.md)
