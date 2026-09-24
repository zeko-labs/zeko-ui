# Getting Started

Operating the Ethereum-backed Zeko network requires both the Zeko execution stack and the Ethereum settlement integration. A Mina-backed rollup deployment is not converted by changing a display name or L1 URL.

## Components to operate

- Zeko sequencer and recursive proof workers.
- The current 2-of-3 DA committee with persistent ledger diffs.
- Archive PostgreSQL, archive relay, and Actions services.
- Ethereum gateway, persistent job/indexer database, and Ethereum RPC access.
- Ethereum settlement, bridge, and asset-registry contracts with matching release artifacts.
- Browser bridge and explorer deployments with public runtime configuration.

The gateway coordinates proof verification, proof requests, Ethereum submissions, and finalized-state indexing. The sequencer remains responsible for Zeko ledger and transaction semantics.

## Deployment source of truth

Use the Ethereum integration's release-matched [Sepolia runbook](https://github.com/zeko-labs/ethereum-settlement/blob/main/docs/content/operations/testnet.md) and [operations guide](https://github.com/zeko-labs/ethereum-settlement/blob/main/docs/content/operations/devops.md). Its `deploy/testnet/` profile and artifact manifest define the contract identities, verification keys, genesis state, DA identities, and service configuration that must agree.

Begin with the repository's current status and security model. Confirm whether the selected environment uses real proof verification or a mock verifier. Retain the complete release identity before deploying or upgrading contracts.

Do not reuse old hardware guidance for Ethereum proving capacity. Sequencer, archive, DA, and SP1 proof workloads have different resource requirements; size each from the deployment's validated configuration.

## Operational boundaries

Keep proof-service credentials and Ethereum submission keys off public browser hosts. Monitor Ethereum finality, gateway job progress, the sequencer commit schedule, DA quorum, and archive/indexer lag separately.

The current testnet uses committee DA. Blob publication and complete blob-to-batch-root binding remain future production work. See [Concepts for Operators](./concepts-for-operators.md) and [Security Model](../architecture/security-model.md).

## Legacy runbooks

The older [Mina-backed operator guides](./guides-tutorials.md#legacy-mina-backed-deployments) remain available for existing deployments. Their Mina node, zkApp deployment, faucet, and wallet steps do not launch the Ethereum-backed stack.
