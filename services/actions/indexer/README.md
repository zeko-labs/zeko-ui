# Actions Indexer

Actions Indexer is a service that indexes actions from the Zeko blockchain and stores them in a database for easy retrieval and querying.

## Diagnostics CLI

Run diagnostics through moon tasks (all tasks invoke the actions-indexer CLI):

```bash
moon run actions-indexer:diagnose
moon run actions-indexer:diagnose-health
moon run actions-indexer:diagnose-sync
moon run actions-indexer:diagnose-resources
```

Examples:

```bash
moon run actions-indexer:diagnose-health -- --url https://indexer.actions.zeko.io --timeout-ms 30000
moon run actions-indexer:diagnose-resources -- --project-id actions-indexer --service-id actions-indexer-deployment
```

`diagnose-resources` requires an authenticated Northflank CLI context in the service workspace:

```bash
cd services/actions/indexer
pnpm exec northflank login
```

The `resources` and `diagnose` commands also need `project-id` and `service-id` values for the deployed service.

Current production values:

```bash
NORTHFLANK_PROJECT_ID=actions-indexer
NORTHFLANK_SERVICE_ID=actions-indexer-deployment
```

The authenticated Northflank identity also needs the permission `Project > Services > Deployment > View Observability`. Without it, the command fails before metrics are returned.

Current metrics output:

- `cpuPercent`: latest Northflank CPU percentage
- `memoryPercent`: latest Northflank memory percentage

## Action Processing Benchmark Workflow

Run local benchmark and stress workflows for the extracted action-processing module:

```bash
moon run actions-indexer:bench-action-processing
moon run actions-indexer:stress-action-processing
moon run actions-indexer:prove-action-processing
```

Implementation layout:

- CLI commands: `src/cli/*`
- Benchmark/stress workloads: `src/benchmark/*`

## Action Processing IPC Runtime

`runActionProcessing` uses a subprocess worker path for the hashing-heavy action-processing workload.

- Transport: parent writes a JSON request to child `stdin`; child writes JSON result to `stdout`.
- Process model: each worker chunk runs in a short-lived Node subprocess.
- Storage: this IPC path does not write payloads to files, so there are no temporary IPC files to clean up.
- Failure behavior: if worker execution fails and fallback is enabled, runtime logs a warning and falls back to main-thread processing.

## Proving IPC Is Faster

Use the proof command to compare main-thread and worker-path median runtimes on the same synthetic workload:

```bash
moon run actions-indexer:prove-action-processing -- --sample-runs 6 --warmup-runs 1 --json
```

Pass criteria:

- worker fallback count is `0`
- worker median runtime is strictly lower than main median runtime

The command exits non-zero when criteria are not met.

## Service Integration Suite

Run a full local integration suite that:

1. starts a Postgres Docker container,
2. migrates the actions schema,
3. starts the actions-indexer service,
4. verifies health/lifecycle endpoints and CLI checks.

```bash
moon run actions-indexer:test-service-integration
```
