# Actions Indexer

Actions Indexer is a service that indexes actions from the Zeko blockchain and stores them in a database for easy retrieval and querying.

## CLI

Run diagnostics and control operations through moon tasks (all tasks invoke the actions-indexer CLI):

```bash
moon run actions-indexer:diagnose
moon run actions-indexer:diagnose-health
moon run actions-indexer:diagnose-sync
moon run actions-indexer:diagnose-resources
AUTH_TOKEN=admin moon run actions-indexer:status -- --url http://127.0.0.1:3000
AUTH_TOKEN=admin moon run actions-indexer:start-indexer -- --url http://127.0.0.1:3000
AUTH_TOKEN=admin moon run actions-indexer:stop-indexer -- --url http://127.0.0.1:3000
AUTH_TOKEN=admin moon run actions-indexer:reset -- --url http://127.0.0.1:3000
AUTH_TOKEN=admin moon run actions-indexer:rebuild -- --url http://127.0.0.1:3000
AUTH_TOKEN=admin moon run actions-indexer:set-interval -- --url http://127.0.0.1:3000 --interval-seconds 30
```

Examples:

```bash
moon run actions-indexer:diagnose-health -- --url https://indexer.actions.zeko.io --timeout-ms 30000
moon run actions-indexer:diagnose-resources -- --project-id actions-indexer --service-id actions-indexer-deployment
```

Authenticated admin commands (`status`, `start`, `stop`, `reset`, `rebuild`, `set-interval`) require `AUTH_TOKEN` in the environment because the matching server endpoints are not public.

`reset` and `rebuild` are different operations:

- `reset`: stops the indexer, clears all indexed table data, and starts it again so it resyncs from scratch.
- `rebuild`: stops the indexer, repopulates indexed table data from the archive sources immediately, and then resumes with the rebuilt heads preserved.

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
- Failure behavior: worker execution errors fail the run. There is no fallback-to-main path.

## Proving IPC Is Faster

Use the proof command to compare main-thread and worker-path median runtimes on the same synthetic workload:

```bash
moon run actions-indexer:prove-action-processing -- --sample-runs 6 --warmup-runs 1 --json
```

Pass criteria:

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
