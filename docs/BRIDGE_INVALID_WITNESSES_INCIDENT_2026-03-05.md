# Bridge Incident Log: Invalid witnesses data (2026-03-05)

## Context

- User-facing error in Bridge UI:
  - `[BRIDGE] findPendingOperation Error: Error: Invalid witnesses data`
  - Stack includes `fetchOuterWitnessesFromAuxes` -> `Bridge.fetchDepositsWithStates`
- Scope investigated: bridge-ui worker, bridge-sdk parser, actions-api GraphQL, actions-indexer health/progress.

## Verified Code Path

- Throw site: `packages/bridge-sdk/src/utils.ts` (`fetchOuterWitnessesFromAuxes`)
  - SDK throws `Error("Invalid witnesses data")` when `outerWitnessesFromAuxes` response does not parse as `Witness[]`.
- Caller: `Bridge.fetchDepositsWithStates` in `packages/bridge-sdk/src/index.ts`.
- Bridge UI entrypoint: `apps/bridge-ui/machines/operations.worker.ts` (`findPendingOperations`).

## Live Investigation Log (UTC)

### 2026-03-05T12:13:37Z -> 12:13:47Z

- Probed `https://api.actions.zeko.io/health` 5 times.
- Result: all 5 responses `status=unhealthy`, `database.status=down`, error contains `Failed query: SELECT 1`.

### 2026-03-05T12:14:33Z -> 12:14:38Z

- Probed GraphQL:
  - `outerWitnessesFromAuxes`
  - `commitAsePastSlot`
- Result: both return `errors[0].extensions.code=INTERNAL_SERVER_ERROR` and `data.<field>=null`.

### 2026-03-05T12:15:28Z

- Reproduced via SDK runtime (bun probe invoking `Bridge.fetchDepositsWithStates`).
- Observed sequence:
  - urql CombinedError: `Unexpected error.` from `https://api.actions.zeko.io/graphql`
  - valibot parse issue: expected array, received `null`
  - thrown SDK error: `Invalid witnesses data` at `packages/bridge-sdk/src/utils.ts`
- This confirms bridge UI error is a direct downstream symptom of actions-api resolver failures.

### 2026-03-05T12:16:49Z

- `https://indexer.actions.zeko.io/health` returned healthy (HTTP 200):
  - `database.status=up`
  - `indexer.status=running`
  - `consecutiveErrors=0`
  - `lastFetchedBlock.outer=501655`, `lastFetchedBlock.inner=960352`

### 2026-03-05T12:17:58Z -> 12:19:37Z

- 12 consecutive `/health` checks to indexer with 8s timeout.
- Result: 12/12 timed out (no body returned before timeout).

### 2026-03-05T12:19:44Z -> 12:20:02Z

- Re-ran indexer `/health` with 30s timeout.
- Result: HTTP 200 healthy, but `x-envoy-upstream-service-time` ~17855ms.
- Indicates endpoint is intermittently very slow/unresponsive.

### 2026-03-05T12:24:06Z -> 12:24:32Z

- Another `/health` with 45s timeout succeeded after ~26s.
- Response still healthy and still reports same lastFetchedBlock values.

### 2026-03-05T12:24:39Z

- Chain tips checked:
  - L1 archive tip: `501657`
  - L2 archive tip: `966084`
- Indexer reported heights at that time:
  - outer: `501655` (near L1 tip)
  - inner: `960352` (significantly below L2 tip)

## Current Assessment

1. Primary bridge breakage is confirmed at actions-api layer (DB connectivity/query failure) causing GraphQL null payloads and SDK parse failure.
2. Indexer is not conclusively down, but its health endpoint is unstable/intermittent and often slow.
3. Indexer outer progress appears current; inner progress must be further validated against expected behavior (no-new-actions vs stalled indexing).

## Open Investigation Items

- Verify actions-api production DB path (Cloudflare Hyperdrive bindings) and why `SELECT 1` fails while Supabase instance has been upgraded.
- Verify whether actions-api and indexer point at the same physical database/credentials.
- Determine whether indexer inner value (`960352`) is expected for configured finality/action frequency or indicates a stall.
- Extract platform logs (Cloudflare Worker + Northflank indexer) for exact failing window.

## Next Actions (In Progress)

- Query L2 archive for `INNER_PK` activity after block `960352` to distinguish expected no-op from stall.
- Correlate indexer health latency with indexing loop behavior.
- Continue appending findings in this file.

### 2026-03-05T12:32:36Z

- Indexer auth behavior check:
  - `/status` with dummy bearer returns HTTP 401 quickly (response body `Unauthorized`).
  - Confirms route is alive when request reaches app, though latency can still be high.

### 2026-03-05T12:33Z

- Validated L2 activity for configured `INNER_PK` (from `services/actions/indexer/.env.example`):
  - from `960352` to tip: exactly 1 action at `960352`
  - from `964000` to tip: 0 actions
  - from `965000` to tip: 0 actions
- Interpretation: `lastFetchedBlock.inner=960352` can be expected and does not, by itself, prove indexer stall.

### 2026-03-05T12:36Z -> 12:38Z (Cloudflare tail)

- Captured live worker logs via `wrangler tail` for `actions-api`.
- Observed resolver-level errors in production worker logs:
  - `outerWitnessesFromAuxes`: query against `witness_actions` + `outer_actions` fails.
  - `innerWitnessesFromAuxes`: query against `inner_actions` fails (including `where false` case).
- Health requests show HTTP 503 with `Executed resolver in 1-2ms` and DB still marked down.
- Errors are currently logged as `Failed query: <sql>\nparams: ...` without underlying DB cause details.

### 2026-03-05T12:40Z (Hyperdrive inspection)

- Queried Cloudflare Hyperdrive configs currently bound in `actions-api`:
  - `HYPERDRIVE` id `abf1ac369edf418ba9243099f96ead76`
  - `HYPERDRIVE_NO_CACHE` id `33ea9e81023146799e5658aae00731fc`
- Both target origin host `db.rvzghxcdyzeulearzlem.supabase.co:5432`, database `postgres`, user `postgres`.

## Updated Assessment

1. Bridge error remains a downstream effect of `actions-api` DB query failures.
2. Indexer appears operational for current observable signals; inner height lag is likely explained by no newer actions for `INNER_PK`.
3. Most probable fault domain is `actions-api` DB access path (Hyperdrive credentials/connectivity/state), not bridge-ui/bridge-sdk logic.

## Immediate Next Actions

- From Cloudflare side, validate Hyperdrive-to-origin connectivity and credentials for both bindings (`cache` and `no-cache`).
- Confirm whether Supabase credentials were rotated during/after instance upgrade and whether Hyperdrive was updated.
- Add temporary server-side logging of `error.cause` in actions-api DB error handling to surface root DB error class (DNS/auth/TLS/pool/permission).
- After remediation, re-run:
  - `GET /health`
  - GraphQL `outerWitnessesFromAuxes`
  - SDK probe `Bridge.fetchDepositsWithStates`

## Root-Source Trace (Where the Error Actually Comes From)

From live logs and source mapping:

1. Bridge-side thrown error (`Invalid witnesses data`) is secondary.
   - It is thrown in `packages/bridge-sdk/src/utils.ts` only because GraphQL returned `null` for witnesses.

2. Primary error source is inside `actions-api` DB execution path.
   - `services/actions/api/src/schema/outer.ts::queryOuterWitnessesFromAuxes` fails at the `db.drizzle.select(...).from(...).innerJoin(...).where(...)` call.
   - `services/actions/api/src/schema/inner.ts::queryInnerWitnessesFromAuxes` also fails at `db.drizzle.select(...).from(inner_actions)...`.
   - Health check fails at `services/actions/api/src/db.ts::checkDatabaseHealth` on `db.drizzle.execute(sql\`SELECT 1\`)`.

3. Why this matters:
   - `SELECT 1` failing proves this is not a witness-data-shape problem and not caused by query filter/input data.
   - This is a DB access failure at the `actions-api` DB client layer (`initializeDrizzle`/postgres client using Hyperdrive connection string), upstream of business query logic.

4. Corroborating log evidence:
   - Worker tail shows resolver errors for both outer and inner witness queries.
   - Even `inner_actions where false` fails, reinforcing that failure is at DB execution path itself, not result contents.

## Conclusion Update

- The error is coming from `actions-api` database execution (Hyperdrive/postgres client path), then propagates as GraphQL internal errors, and finally surfaces in bridge-sdk as `Invalid witnesses data`.
- This is not caused by indexer witness payload shape and not caused by bridge-ui worker logic.

### 2026-03-05T13:05Z (Manual Live E2E Re-run)

- Executed `moon run actions-api:manual-e2e-live` after fixing runtime skip gating in the live e2e test.
- Result:
  - `GET https://api.actions.zeko.io/health` failed with HTTP `503`
  - Response body: `database.status=down`, error `Failed query: SELECT 1`
  - GraphQL `outerWitnessesFromAuxes` failed with HTTP `200` + `errors[0].extensions.code=INTERNAL_SERVER_ERROR` and `data.outerWitnessesFromAuxes=null`
- Interpretation:
  - The production failure is still active and reproducible.
  - Root cause remains upstream DB execution failure in actions-api; bridge-sdk `Invalid witnesses data` remains a downstream symptom.

### 2026-03-05T13:10Z -> 13:11Z (Root Cause Isolated in Code)

- Isolated local DB integration failure by running `tests/actions.test.ts` under a Node-only Vitest config.
- Found API DB client initialization bug:
  - Code was using `drizzle(client, config)`.
  - With current `drizzle-orm` beta version, this call shape is invalid and falls through to creating a default postgres client (`pgClient(undefined)`), which targets `localhost:5432`.
  - This exactly matches observed runtime errors (`ECONNREFUSED ::1:5432` / `127.0.0.1:5432`) and production health/query failures (`Failed query: SELECT 1`).
- Applied fix in actions-api:
  - `services/actions/api/src/db.ts`: switched to `drizzle({ client, logger: true })`.
  - `services/actions/api/tests/actions.test.ts`: switched test DB creation to `drizzle({ client, logger: false })`.
- Validation:
  - Local DB integration test now passes (`9/9`).
  - Live manual e2e against production still fails (expected until this fix is reviewed and deployed).
