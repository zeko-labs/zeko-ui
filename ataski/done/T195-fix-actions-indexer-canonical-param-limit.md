---
id: T195
title: "Fix actions indexer canonical promotion parameter limit"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-11T18:22:52Z
updated_at: 2026-05-11T18:52:39Z
---

## Requirements

- Investigate the actions indexer failure reported in Linear ZK-535:
  - `Invalid commit ASE past withdrawal delay data: Invalid type: Expected Object but received null`
  - Indexer log root error: `MAX_PARAMETERS_EXCEEDED: Max number of parameters (65534) exceeded`
  - Failing path: `promoteCanonicalActions`, updating `outer_actions.marked_as_canonical_at` with a very large `after_state in (...)` predicate.
- Identify the root cause in `services/actions/indexer` and fix canonical action promotion so indexing archive data cannot generate a PostgreSQL statement exceeding the bind parameter limit.
- Keep the fix scoped to the indexer data path and follow existing repository patterns.
- Preserve correctness for canonical marking: all intended matching outer actions must still be marked canonical.
- Add meaningful regression coverage for the query chunking or equivalent mitigation.
- Validate with repository tasks from root through `moon run`, after inspecting the project `moon.yml`.
- Run the actions indexer locally against archive data and verify archive data can be indexed without the reported failure. If local credentials or infrastructure block this, record the exact blocker and provide the strongest local validation available.

## Test Plan

- DDD: first inspect the existing indexer implementation and tests to characterize the failure from the production log and derive the smallest behavior boundary to validate.
- RED path: add or run a focused test that fails against the current implementation by exercising canonical promotion with more `after_state` values than PostgreSQL's bind parameter limit permits, or document why the existing code path is not directly testable before refactor.
- GREEN path: implement bounded query batching or an equivalent structured SQL approach, then run focused tests, typecheck/build, and local indexer validation.

## RED Evidence

- Added focused regression coverage in `services/actions/indexer/test/canonical-progress.test.ts` for `promoteOuterCanonicalActions` with 65,534 unique `afterState` values and one matching row.
- RED command:
  `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55434/actions AUTH_TOKEN=test L1_ARCHIVE_URL=http://127.0.0.1:1/graphql L2_ARCHIVE_URL=http://127.0.0.1:1/graphql OUTER_PK=TEST_OUTER_PK INNER_PK=TEST_INNER_PK pnpm --filter @zeko/actions-indexer exec vitest run test/canonical-progress.test.ts --testNamePattern "Postgres parameter limit"`
- RED result: failed with `MAX_PARAMETERS_EXCEEDED: Max number of parameters (65534) exceeded`, matching the production log's failing query shape.

## GREEN Evidence

- Regression suite:
  `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55434/actions AUTH_TOKEN=test L1_ARCHIVE_URL=http://127.0.0.1:1/graphql L2_ARCHIVE_URL=http://127.0.0.1:1/graphql OUTER_PK=TEST_OUTER_PK INNER_PK=TEST_INNER_PK pnpm --filter @zeko/actions-indexer exec vitest run test/canonical-progress.test.ts`
  Result: 3 tests passed.
- `moon run actions-indexer:lint -f`: passed.
- `moon run actions-indexer:typecheck -f`: passed.
- `moon run actions-indexer:build -f`: passed.
- Testnet archive validation:
  - Ran the local actions indexer against a clean Docker Postgres database with `L2_ARCHIVE_URL=https://archive.testnet.zeko.io/graphql`, `OUTER_PK=B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2`, and `INNER_PK=B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`.
  - Indexed `68,979` outer action rows and `10,530` inner action rows.
  - Processed `68,784` outer canonical after-states through canonical promotion without `MAX_PARAMETERS_EXCEEDED`.
  - `moon run actions-indexer:diagnose-sync -- --base-url http://127.0.0.1:53600 --json --timeout-ms 30000` returned `status: ok` for both outer and inner streams with `hasPendingActions=false`.
