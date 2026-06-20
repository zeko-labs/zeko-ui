# Zeko Bridge

The Zeko Bridge moves assets between Mina (L1) and Zeko (L2).

Use the interface that matches your job:

- [Mainnet Bridge UI](https://bridge.zeko.io) for interactive mainnet bridging in the browser
- [Testnet Bridge UI](https://testnet.bridge.zeko.io) for interactive testnet bridging in the browser
- [Bridge CLI](/developers/tools/bridge-cli) for unattended and agent-driven bridging
- [Bridge SDK](/developers/tools/bridge-sdk) for custom applications and automation

## High-Level Protocol Behavior

At the protocol level, bridging is a two-step process:

1. Submit the bridge action on the source chain.
2. Claim the bridged asset on the destination chain once the protocol state makes that claim valid.

The waiting time between those two steps can be long. That is normal. The bridge has to wait for chain progress, sequencer processing, archive/indexer availability, and the proof or witness data required to safely claim the asset.

## Mina To Zeko Deposits

For a deposit from Mina to Zeko, the flow is:

1. Submit the deposit on Mina.
2. Wait for the deposit to settle into the bridge state.
3. Check both `canFinalizeDeposit` and `canCancelDeposit`.
4. If the deposit becomes finalizable, finalize it on Zeko.
5. If the deposit becomes cancellable, cancel it on Mina.

Important protocol rules:

- A cancellable deposit can never later be finalized.
- Deposit claims are queue-ordered.
- Cancellable deposits are skippable.
- Finalizable deposits must never be skipped, because skipping them would strand user funds in the queue.

This is why queue handling matters so much in both the CLI and any application built on the SDK.

## Zeko To Mina Withdrawals

For a withdrawal from Zeko to Mina, the flow is:

1. Submit the withdrawal on Zeko.
2. Wait for the sequencer and indexer pipeline to make the withdrawal witnessable.
3. Finalize the withdrawal on Mina.

Withdrawals are also queue-ordered, but unlike deposits they are not cancellable. The earliest pending withdrawal for the account must be finalized first.

## Why A Bridge Can Take So Long

Long waits usually come from bridge state propagation rather than from the local wallet:

- Mina-side settlement and finality can take time.
- The Zeko sequencer can see a new action before the archive or actions API can serve the corresponding witness data.
- Finalization proof generation can take a long time.

As a result, a good bridge client must tolerate long unattended waits and keep following the queue until the requested operation reaches a real terminal outcome.

## Operational Model

The Bridge UI, Bridge CLI, and Bridge SDK all model the same protocol:

- submit first
- wait for the earliest actionable queue item
- finalize when finalizable
- cancel immediately when cancellable
- never skip a finalizable deposit

The main difference is the signing model:

- the Bridge UI waits for interactive wallet approvals on [mainnet](https://bridge.zeko.io) or [testnet](https://testnet.bridge.zeko.io)
- the [Bridge CLI](/developers/tools/bridge-cli) is designed for unattended execution with local keys
- the [Bridge SDK](/developers/tools/bridge-sdk) exposes the underlying operations so other applications can build their own orchestration

For operator debugging, the Bridge CLI supports `--actions-api`, `--l1-url`, and `--l1-archive-url` endpoint overrides so a run can target a local Actions API/indexer stack or alternate Mina endpoints without source changes.
