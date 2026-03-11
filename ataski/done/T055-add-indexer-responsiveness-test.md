---
id: T055
title: "Add indexer responsiveness test"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-09T16:30:00Z
updated_at: 2026-03-09T16:34:59Z
---

## Scope

Add an integration test that proves the actions-indexer service remains responsive while long-running worker action-processing is in flight.

## TDD Exception

This is an integration-level responsiveness property that depends on real subprocess execution and concurrent HTTP handling. A narrow RED-first unit test would not exercise the actual service/worker interaction.

Validation strategy:

1. Add an integration test that runs a long worker-processing request concurrently with `/health`.
2. Validate that `/health` returns successfully within a bounded latency while worker processing is still running.
3. Re-run targeted and service integration suites.

## RED Evidence

Command:

- `moon run actions-indexer:test-service-integration -f`

Result:

- New responsiveness integration test failed.
- `/health` latency reached about `4518ms` during the long-running worker request.
- Root cause in the test setup: the test-only route was generating synthetic action blocks inside the request handler, which is itself CPU-heavy and blocks the main thread before worker processing begins.

## GREEN Evidence

Commands:

1. `moon run actions-indexer:typecheck -f`
2. `moon run actions-indexer:lint -f`
3. `moon run actions-indexer:test-service-integration -f`

Result:

- Typecheck and lint passed.
- The new service integration test now passes with a precomputed test workload, so the request path measures real worker execution instead of local setup cost.
- During the long-running worker request, the integration test successfully completed three sequential `/health` probes under the `1500ms` bound.
