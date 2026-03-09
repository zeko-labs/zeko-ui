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
moon run actions-indexer:diagnose-resources -- --project-id <project> --service-id <service>
```

## Action Processing Benchmark Workflow

Run local benchmark and stress workflows for the extracted action-processing module:

```bash
moon run actions-indexer:bench-action-processing
moon run actions-indexer:stress-action-processing
```

Implementation layout:

- CLI commands: `src/cli/*`
- Benchmark/stress workloads: `src/benchmark/*`

## Service Integration Suite

Run a full local integration suite that:

1. starts a Postgres Docker container,
2. migrates the actions schema,
3. starts the actions-indexer service,
4. verifies health/lifecycle endpoints and CLI checks.

```bash
moon run actions-indexer:test-service-integration
```
