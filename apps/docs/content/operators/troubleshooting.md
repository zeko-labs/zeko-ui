# Troubleshooting

Use this page when an operator guide does not produce the expected service state. Start with the component you changed most recently, then work outward to dependent services.

## Service Does Not Start

1. Confirm that the command was run from the directory that contains the expected `docker-compose.yaml`.
2. Check container status with `docker compose ps`.
3. Read the failing container logs with `docker compose logs <service>`.
4. Verify that required environment variables, private keys, ports, and volume paths are present.
5. Restart only the failed service after correcting configuration.

## DA Layer Issues

For DA node setup, compare your local compose file with [Running Zeko's DA Node](./guides/da-layer.md).

Common checks:

- the DA service has a persistent volume
- the service port is not already in use
- peer, signer, and contract configuration match the network you intend to run
- archive services use the same DA service name documented in the archive guide

## Archive Node Issues

For archive setup, start from [Running Zeko's Archive Node](./guides/archive-node.md).

Common checks:

- PostgreSQL is healthy before indexer services start
- database migrations or init containers completed successfully
- the archive stack can reach the DA node from inside the Docker network
- disk space is available for indexed history

## Rollup Launch Issues

For full rollup setup, use [Launch a Rollup](./guides/launch-rollup.md) as the source of truth.

Common checks:

- the sequencer wallet is funded and uses the expected key
- the faucet wallet is separate from the sequencer wallet
- deployment and circuit configuration match the target network
- prover services have enough memory and CPU
- L1 and DA endpoints are reachable from the sequencer container

## When Asking For Help

Include the guide you followed, the service name, the command that failed, the relevant log lines, and whether you are running locally, on a server, or on Phala.
