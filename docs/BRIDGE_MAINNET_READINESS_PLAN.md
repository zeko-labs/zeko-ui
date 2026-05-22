# Bridge Mainnet Readiness Implementation Plan

Date: 2026-05-21

Baseline:

- Branch: `branch/filter-legacy-bridge-operations`
- Merge baseline: `40dae9a` (`origin/main` merged after SDK module refactor)
- Scope: Actions API, Actions indexer, Actions database, Bridge UI, Bridge CLI, Bridge SDK examples/docs, deployment workflows, and validation

This document is the single source of truth for implementation. It is written for an implementation agent that does not have the surrounding conversation.

## Target Outcome

Ship one PR that makes the bridge stack mainnet-ready while preserving testnet.

| Environment | Actions API                   | Actions Indexer                   | Actions DB                    | Bridge UI                                            | Deployment owner                                        |
| ----------- | ----------------------------- | --------------------------------- | ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| testnet     | `testnet.api.actions.zeko.io` | `testnet.indexer.actions.zeko.io` | current `actions` Supabase DB | alpha/staging code channel at `alpha.bridge.zeko.io` | auto-deploy from `main`                                 |
| mainnet     | `api.actions.zeko.io`         | `indexer.actions.zeko.io`         | fresh Supabase DB             | production code channel at `bridge.zeko.io`          | one GitHub Actions workflow using environment `mainnet` |

Current `api.actions.zeko.io` serves testnet traffic. Cutover means:

1. Stand up `testnet.api.actions.zeko.io` against the current DB.
2. Move testnet consumers to that hostname.
3. Provision and validate the fresh mainnet DB, indexer, API, and UI.
4. Move `api.actions.zeko.io` to mainnet.

Domain rules:

- `alpha` and `testnet` share the testnet infrastructure environment.
- Do not create a separate alpha stack.
- Treat `alpha.bridge.zeko.io` as the alpha/staging Bridge UI code channel.
- Bridge hostnames select the deployed code channel, not the user's bridge network. Both `bridge.zeko.io` and `alpha.bridge.zeko.io` must be capable of selecting supported testnet and mainnet routes.
- Normalize old alphanet/testnet config distinctions so alpha is described as the staging code channel on testnet infrastructure, not a third infrastructure environment.

## Safety Rules

- The PR may prepare real infrastructure changes, but it must not execute live deploys before the changes are reviewed.
- Any Cloudflare, Supabase, Northflank, or GitHub mutation must be represented as a reviewable script or workflow step.
- Do not use ad hoc CLI operations as the deployment procedure.
- Temporary deployment/provisioning scripts must live in the repo, default to dry-run or plan output, and require an explicit execution flag such as `--execute` for mutations.
- Testnet deploys continue from `main`.
- Mainnet deploys only through the unified GitHub Actions workflow gated by the GitHub environment named `mainnet`.
- Existing production/testnet services must remain functional until the reviewed cutover path is intentionally run.
- Only deploy after the PR and scripts/workflows have been properly reviewed.
- When implementation requires a decision, command, script behavior, or file edit that is not explicitly specified in this document, record it in the Implementation Review Log section before opening the PR.
- After implementation and validation are complete, commit the finished work, push the branch, and open a PR for review.

## Repository Workflow

This is source/config/runtime work. Follow `AGENTS.md`:

- Use Ataski before source edits.
- Use a dedicated worktree/branch according to the Ataski workflow.
- Run repo workflows through `moon run` or `moon exec --ignore-ci-checks`.
- Do not add package scripts as workflow entrypoints.
- Do not manually edit generated `worker-configuration.d.ts`; update Wrangler config and run the relevant `type-cf` task.
- Before implementation, clean the stale Ataski board drift where `ataski/in-progress/T093-finalize-bridge-cli-release-and-validator-ops.md` exists even though `ataski/tasks.md` records `T093` as done under a different task.
- Create new Ataski implementation tasks starting from the next unused ID, and keep this plan as context rather than treating it as executable board state.

## Confirmed Current State

Actions stack:

- Actions API Worker config is single-environment today: `services/actions/api/wrangler.jsonc`.
- Actions API Cloudflare Build config is single Worker today: `services/actions/api/workers-build.jsonc`.
- Actions API migrations run from `.github/workflows/actions-migrations.yaml` with ambiguous secret `ACTIONS_DATABASE_URL`.
- Current working Supabase `actions` DB remains testnet.
- Mainnet needs a fresh Supabase database.
- Actions indexer infrastructure is GitOps-managed by `northflank/actions-indexer/project.json`.
- The Northflank template already defines one project, one build service, one deployment service, one pipeline, and release/preview flows.
- The pipeline currently has a populated `Development` stage with a `main` branch Git trigger. `Staging` and `Production` stages are empty.
- The checked-in Northflank template runtime env only declares `DATABASE_URL`, `AUTH_TOKEN`, `PORT`, and `L1_ARCHIVE_URL`.
- The live `actions-indexer-deployment` runtime env currently exposes `AUTH_TOKEN`, `DATABASE_URL`, `INNER_PK`, `L1_ARCHIVE_URL`, `L2_ARCHIVE_URL`, `OUTER_PK`, and `PORT`.
- The checked-in template does not fully describe the live service env. Preserve live testnet values via secure Northflank storage rather than hardcoding secrets.

Consumers:

- Bridge UI and Bridge CLI currently point both testnet and mainnet Actions reads at `https://api.actions.zeko.io/graphql`.
- Bridge SDK accepts `actionsApi` through config and should stay environment-agnostic.
- SDK examples currently hardcode `l1Network` and `l2Network` to `testnet`.

Bridge UI deployment:

- `apps/bridge-ui/wrangler.jsonc` currently routes the default Worker to `bridge.zeko.io` and `alpha.bridge.zeko.io`.
- `apps/bridge-ui/workers-build.jsonc` currently runs `bridge-ui:deploy` on `main`.
- `apps/bridge-ui/deploy-ci.sh` currently treats `WORKERS_CI_BRANCH=main` as production and runs plain `wrangler deploy`.

Resource access checks already performed from this workspace:

- Cloudflare Wrangler is logged in and can list existing Hyperdrive configs.
- The Cloudflare token has Workers write-level permissions, and `wrangler hyperdrive create` is available.
- Northflank CLI is authenticated and can list projects and read the live `actions-indexer-deployment` service.
- Northflank project creation commands exist, but actual create permission is not proven without mutating infrastructure.
- Supabase CLI is installed and authenticated.
- Supabase CLI can list orgs and projects. Existing relevant project: `actions` with ref `rvzghxcdyzeulearzlem` under `zekoxyz's Org`.
- Supabase project creation command exists. Actual create permission is not proven without mutating infrastructure.

## Reviewable Infra Scripts

Add temporary scripts under `scripts/mainnet-readiness/` for provisioning and deployment preparation.

Script requirements:

- Use Nushell through `proto-nu`; do not add shell scripts for the temporary deployment/provisioning helpers.
- Print exact planned Cloudflare, Supabase, Northflank, and GitHub operations.
- Default to dry-run or plan output.
- Require an explicit execution flag such as `--execute` for mutations.
- Avoid storing concrete secrets in the repo.
- Be used by reviewers/operators as the documented path for live mutations after review.

The scripts should cover:

- Mainnet Supabase project/database creation plan.
- Mainnet Cloudflare Hyperdrive creation plan.
- GitHub secret/environment setup plan.
- Northflank template/stage release trigger plan, including the exact CI invocation discovered during implementation.
- Any post-review cutover steps that cannot be represented directly in GitHub Actions.

## Actions API

Use Wrangler environments for the Actions API. Wrangler environments are selected with `--env`/`-e` or `CLOUDFLARE_ENV`, and bindings/vars are non-inheritable. Because Hyperdrive is a binding, each environment must declare its own `HYPERDRIVE`, `HYPERDRIVE_NO_CACHE`, routes, and `vars`.

Update `services/actions/api/wrangler.jsonc`:

- Top-level/default config is mainnet after cutover:
  - `name`: `actions-api`
  - route `api.actions.zeko.io`
  - `vars.ENVIRONMENT = "mainnet"`
  - mainnet `HYPERDRIVE` and `HYPERDRIVE_NO_CACHE` IDs after those resources exist
- Add `env.testnet`:
  - route `testnet.api.actions.zeko.io`
  - `vars.ENVIRONMENT = "testnet"`
  - existing/current Hyperdrive IDs for the current testnet DB

Add Actions API Moon tasks:

```yaml
deploy-testnet: wrangler deploy --env testnet
deploy-mainnet: wrangler deploy
live-e2e-testnet: ACTIONS_API_E2E_BASE_URL=https://testnet.api.actions.zeko.io vitest run tests/actions.live-e2e.test.ts
live-e2e-mainnet: ACTIONS_API_E2E_BASE_URL=https://api.actions.zeko.io vitest run tests/actions.live-e2e.test.ts
```

Use `moon exec --ignore-ci-checks` from GitHub Actions, not `options.runInCI: true`, because these are deploy and live-check tasks.

Regenerate Cloudflare worker types with:

```bash
moon run actions-api:type-cf
```

Do not manually edit `services/actions/api/worker-configuration.d.ts`.

Split Actions API deployment ownership:

- Testnet should continue deploying automatically through Cloudflare Build on `main` when API-relevant files change.
- Mainnet should deploy only through the unified GitHub Actions workflow gated by the GitHub environment named `mainnet`.
- Cloudflare Build default-branch deployment must call the testnet Wrangler environment. It must not be disabled just to avoid mainnet deployment.

## Actions Database

Use the current Supabase DB as testnet. Do not copy rows from testnet to mainnet, and do not run migrations against testnet solely for stack duplication.

Mainnet gets a fresh Supabase project/database in `zekoxyz's Org`.

Provisioning sequence:

1. Create the fresh mainnet Supabase project/database through reviewed scripts only.
2. Store the connection string in `ACTIONS_MAINNET_DATABASE_URL` and relevant Cloudflare/Northflank secrets.
3. Create mainnet Cloudflare Hyperdrive configs against that connection string through reviewed scripts only.
4. Put the resulting Hyperdrive IDs into top-level/mainnet `services/actions/api/wrangler.jsonc`.
5. Run existing Actions API migrations once against mainnet through the unified mainnet GitHub Actions workflow.
6. Let the mainnet indexer backfill/derive data from archive sources.

The actions `db-seed` task is currently a noop. The real seed operation is archive backfill by the indexer.

Explicit migration secret names:

- `ACTIONS_TESTNET_DATABASE_URL`
- `ACTIONS_MAINNET_DATABASE_URL`

Update or replace `.github/workflows/actions-migrations.yaml`:

- Rename ambiguous `ACTIONS_DATABASE_URL` usage.
- Testnet migrations run automatically from `main` only when migration/schema files change.
- Mainnet migrations run inside the unified mainnet GitHub Actions workflow using GitHub environment `mainnet`.

Existing testnet Hyperdrive configs:

- cached: `actions-db-cache`
- no-cache: `actions-db-no-cache`

Mainnet Hyperdrive configs to create after the mainnet Supabase DB exists:

- `actions-mainnet-db-cache`
- `actions-mainnet-db-no-cache`

Command shape to encode in a reviewable script:

```bash
pnpm --dir services/actions/api exec wrangler hyperdrive create actions-mainnet-db-cache \
  --connection-string "$ACTIONS_MAINNET_DATABASE_URL" \
  --max-age 5 \
  --swr 5

pnpm --dir services/actions/api exec wrangler hyperdrive create actions-mainnet-db-no-cache \
  --connection-string "$ACTIONS_MAINNET_DATABASE_URL" \
  --caching-disabled
```

## Actions Indexer

Do not create separate template roots for testnet and mainnet.

Use one Northflank project/template and model testnet/mainnet as pipeline stages inside that project. Pipelines are the intended implementation path for this work. Do not migrate to Northflank Environments/workflows for this plan.

Target Northflank shape:

- project: `actions-indexer` or a renamed equivalent if renaming is safe
- one shared build service
- two deployment services, one per environment:
  - testnet deployment with domain `testnet.indexer.actions.zeko.io`
  - mainnet deployment with domain `indexer.actions.zeko.io`
- one release flow for testnet, triggered from `main` when indexer-relevant files change
- one mainnet pipeline stage/release flow that is not human-triggered directly; GitHub Actions triggers it as part of the single mainnet release workflow
- optional preview environment support can stay PR-based if useful

The existing live deployment should be renamed/modeled as the testnet deployment rather than replaced by an unrelated service first.

Keep secrets and concrete env values out of the template. Use supported externalized values:

- template arguments with secure argument overrides, referenced as `${args.<name>}`
- secret groups attached to the relevant deployment service
- pipeline-stage arguments/variables

The template may contain variable names and references, but not actual secret values.

Required runtime variable names for each deployment:

- `DATABASE_URL`
- `AUTH_TOKEN`
- `PORT`
- `L1_ARCHIVE_URL`
- `L2_ARCHIVE_URL`
- `OUTER_PK`
- `INNER_PK`
- `ENVIRONMENT`
- optional `L1_FINALITY`
- optional `L2_FINALITY_TIME_H`

Testnet values:

- Reuse the current working live values through secure storage.
- Serve admin/health/control API at `testnet.indexer.actions.zeko.io`.

Mainnet values:

- `DATABASE_URL`: fresh mainnet Supabase connection string
- `AUTH_TOKEN`: new mainnet admin token
- `L1_ARCHIVE_URL`: `https://api.minascan.io/archive/mainnet/v1/graphql`
- `L2_ARCHIVE_URL`: `https://archive.mainnet.zeko.io/graphql`
- `OUTER_PK`: `B62qipwmBKAhWoDr19ydyM3jr2Cwr6rVnrWYUUfLam8oCWedPSem4aC`
- `INNER_PK`: `B62qipwmBKAhWoDr19ydyM3jr2Cwr6rVnrWYUUfLam8oCWedPSem4aC`
- `ENVIRONMENT`: `mainnet`

Northflank invocation requirement:

- Use Northflank's release-flow API endpoint for triggering the `Mainnet` pipeline stage from GitHub Actions:

```bash
curl -fsS -X POST "https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/pipelines/${NORTHFLANK_PIPELINE_ID}/release-flows/${NORTHFLANK_STAGE:-Mainnet}/runs" \
  -H "Authorization: Bearer ${NORTHFLANK_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"name\":\"Bridge mainnet release ${GITHUB_RUN_NUMBER}\",\"description\":\"Triggered by ${GITHUB_REPOSITORY}@${GITHUB_SHA}\",\"arguments\":{\"BRANCH\":\"${GITHUB_REF_NAME:-main}\",\"SHA\":\"${GITHUB_SHA}\"}}"
```

- Provide `NORTHFLANK_API_TOKEN`, `NORTHFLANK_PROJECT_ID`, and `NORTHFLANK_PIPELINE_ID` in the GitHub `mainnet` environment; `NORTHFLANK_STAGE` may override the default `Mainnet` stage name if review chooses a different stage slug.
- Encode this invocation in the reviewed workflow and/or Nushell helper script.
- Do not leave the workflow with a placeholder command.
- Record the discovery path and final command in the Implementation Review Log.

## Bridge UI Deployment

Update `apps/bridge-ui/wrangler.jsonc`:

- Top-level/default config is mainnet:
  - route `bridge.zeko.io`
- `env.testnet` is the alpha/staging code channel:
  - route `alpha.bridge.zeko.io`
- `alpha.bridge.zeko.io` must not be attached to the production/mainnet default config.

Update `apps/bridge-ui/workers-build.jsonc`:

- Default-branch trigger on `main` must deploy testnet Bridge UI only.
- It should call `moon exec --ignore-ci-checks bridge-ui:deploy-testnet`.
- Non-main branches keep preview deployment behavior and must upload testnet-env preview versions, not mainnet versions.

Rewrite the Bridge UI deploy script using Nushell installed through `proto-nu`.

Add `proto-nu` to `.prototools`:

```toml
[plugins]
nu = "github://hebilicious/proto-nu"

[tools.nu]
version = "0.112.2"
```

Replace `apps/bridge-ui/deploy-ci.sh` with a Nushell entrypoint, for example `apps/bridge-ui/deploy-ci.nu`, invoked through `proto run nu --`. Cloudflare Builds install the pinned proto/Nushell toolchain in their checked-in build command, so normal Moon deploy tasks do not need a separate shell bootstrap.

Current shell behavior that must be removed:

- Lines 16-27 derive deploy behavior only from `WORKERS_CI_BRANCH`.
- Lines 18-20 set `SENTRY_ENVIRONMENT=production` and `SENTRY_RELEASE=$(sentry-cli releases propose-version)` when `WORKERS_CI_BRANCH=main`.
- Lines 47-53 run plain `wrangler deploy` for `main`, and `wrangler versions upload` otherwise.
- This means the current default-branch Cloudflare Build path publishes to the default Worker routes, which currently include `bridge.zeko.io`.

Required script behavior:

- Support an explicit deployment target, for example `BRIDGE_UI_DEPLOY_TARGET=testnet|mainnet|preview` or an equivalent Nushell flag, for reviewed deploy paths and local/operator preview use.
- `testnet` target:
  - use Sentry environment `testnet`
  - run `wrangler deploy --env testnet`
  - deploy route `alpha.bridge.zeko.io`
- `mainnet` target:
  - use Sentry environment `mainnet`
  - run plain `wrangler deploy`
  - deploy route `bridge.zeko.io`
- `preview` target in the Nushell script:
  - keep branch-hashed preview Sentry environment
  - run `wrangler versions upload --env testnet`
- Do not infer production deployment solely from `WORKERS_CI_BRANCH=main`.
- Fail fast if required CI variables are missing for the selected target.
- Preserve sourcemap injection/upload and release finalization for all targets unless a target explicitly does not use Sentry.

Required Moon task shape:

```yaml
deploy-testnet: BRIDGE_UI_DEPLOY_TARGET=testnet proto run nu -- ./deploy-ci.nu
deploy-mainnet: BRIDGE_UI_DEPLOY_TARGET=mainnet proto run nu -- ./deploy-ci.nu
deploy-preview: BRIDGE_UI_DEPLOY_TARGET=preview proto run nu -- ./deploy-ci.nu
```

Existing `deploy` can either become an alias for `deploy-testnet` or be removed from Cloudflare Build usage. The important invariant is: `main` must not call a task that deploys `bridge.zeko.io`.

## Mainnet Release Workflow

Create `.github/workflows/bridge-mainnet-release.yaml`.

This is the single mainnet release orchestrator. It must use:

```yaml
environment: mainnet
```

The workflow should be manually triggered with `workflow_dispatch` during launch and can later be extended if the team wants automated release promotion.

Required job order:

1. Check out repo and install the Moon/proto toolchain.
2. Run mainnet Actions DB migrations using `ACTIONS_MAINNET_DATABASE_URL`.
3. Deploy Actions API mainnet:

```bash
moon exec --ignore-ci-checks actions-api:deploy-mainnet
```

4. Trigger the Northflank mainnet indexer pipeline stage/release flow from GitHub Actions.
5. Poll or wait for Northflank completion if supported cleanly; otherwise run health checks with retry/backoff.
6. Validate Actions API mainnet:

```bash
curl -fsS https://api.actions.zeko.io/health
moon exec --ignore-ci-checks actions-api:live-e2e-mainnet -f
```

7. Validate Actions indexer mainnet:

```bash
curl -fsS https://indexer.actions.zeko.io/health
moon run actions-indexer:diagnose-health -- --url https://indexer.actions.zeko.io --timeout-ms 30000
```

8. Deploy Bridge UI mainnet:

```bash
moon exec --ignore-ci-checks bridge-ui:deploy-mainnet
```

9. Run read-only smoke checks against `https://bridge.zeko.io`.

Do not require a second manual approval in Northflank. The GitHub `mainnet` environment is the approval gate. Bridge UI mainnet deployment is part of this same unified workflow; do not split it into a separate manual release step.

## Testnet Automation

On merge to `main`:

- Cloudflare Build deploys the Actions API testnet Worker when API files changed.
- Northflank release flow deploys the testnet indexer when indexer files or shared dependencies changed.
- DB migrations run against testnet only when migration files changed.
- Cloudflare Build deploys the Bridge UI alpha/staging code channel only by invoking `bridge-ui:deploy-testnet`.
- There is no standalone GitHub Actions testnet deploy workflow; testnet remains the automatic deploy path owned by the existing platform integrations.

## Consumer And SDK Changes

Update all consumers so Actions API selection follows the L2 network:

- testnet/alpha L2 -> `https://testnet.api.actions.zeko.io/graphql`
- mainnet L2 -> `https://api.actions.zeko.io/graphql`

Known files:

- `apps/bridge-ui/machines/helpers.ts`
- `packages/bridge-cli/src/core/sdk-config.ts`
- `packages/bridge-cli/tests/sdk-config.test.ts`
- SDK examples and docs defaults
- Zeko skill endpoint references

Bridge UI:

- Treat alpha as testnet in any UI/domain copy or config.
- Existing network guards can be removed or changed as needed in the same PR because deploy, backend, UI, SDK, and CLI changes land together.

Bridge CLI:

- Mainnet routes can be enabled in this PR.
- Add tests for both testnet and mainnet route config.
- Add tests that testnet routes use `testnet.api.actions.zeko.io` and mainnet routes use `api.actions.zeko.io`.
- `doctor` should show route status, SDK endpoint mapping, Actions API URL, and backend health/readiness.
- CLI publishing is a release process outside this implementation PR; the implementation PR should make the CLI configuration correct for both testnet and mainnet.

Bridge SDK examples:

- Add `L1_NETWORK` and `L2_NETWORK` env handling.
- Validate network IDs as o1js `NetworkId` values.
- Add `L1_NETWORK` and `L2_NETWORK` to SDK env examples.
- Make testnet examples default to `https://testnet.api.actions.zeko.io/graphql`.
- Make mainnet examples require `https://api.actions.zeko.io/graphql`.
- Update `packages/bridge-sdk/test/live.manual.test.ts` to read network IDs from env.

Bridge SDK core:

- Keep `actionsApi` as caller-provided config.
- Mainnet has no v1 deposits, so mainnet `V2_DEPOSITS_START_INDEX` remains `0`.
- Mainnet `V2_WITHDRAWALS_START_INDEX` remains `0` unless a mainnet legacy history cutoff is introduced later.
- `BRIDGE_DEPLOY_BLOCK = 430_000` is testnet-specific and must become network-specific before mainnet routes are enabled.
- `SKIPPED_LEGACY_WITHDRAWAL_ACTION_INDEX = 3` is testnet-specific and must be network-guarded.

## Docs And Agent References

Update docs so no reader needs this plan for context:

- `packages/bridge-cli/README.md`
- `packages/bridge-sdk/README.md`
- SDK example env files
- `packages/zeko-skills/zeko/references/30-bridge-and-faucet.md`
- `packages/zeko-skills/zeko/references/40-endpoints-and-curl.md`
- Any docs site pages that mirror package READMEs

Required docs content:

- Testnet Actions API is `https://testnet.api.actions.zeko.io/graphql`.
- Mainnet Actions API is `https://api.actions.zeko.io/graphql`.
- Alpha Bridge UI is the staging code channel.
- Mainnet Bridge UI is `https://bridge.zeko.io`.
- Alpha Bridge UI is `https://alpha.bridge.zeko.io`.
- SDK examples must use matching L1/L2 network IDs and Actions API endpoint.

## Implementation Order

1. Clean stale Ataski board drift.
2. Create Ataski tasks/worktree/branch according to repo workflow.
3. Add reviewable dry-run-first provisioning/deployment scripts under `scripts/mainnet-readiness/`.
4. Add `proto-nu` to `.prototools` and rewrite Bridge UI deploy logic in Nushell.
5. Use Nushell through `proto-nu` for all temporary mainnet-readiness deployment/provisioning scripts.
6. Add Actions API Wrangler env split.
7. Add Actions API Moon deploy/live-e2e tasks.
8. Update Actions migrations workflow/secrets to testnet/mainnet names.
9. Keep Actions API testnet deploy owned by Cloudflare Build; do not add a testnet deploy workflow.
10. Provision mainnet Supabase and Hyperdrive resources through reviewed scripts only.
11. Update Northflank template for one pipeline-backed project with testnet/mainnet deployment services.
12. Figure out and encode the exact Northflank CI invocation for the mainnet pipeline stage.
13. Rename/model the existing Northflank deployment as testnet and point it at `testnet.indexer.actions.zeko.io` without breaking the working service.
14. Configure testnet and mainnet Northflank domains/env values through secure storage.
15. Split Bridge UI Wrangler routes with alpha as testnet alias.
16. Add Bridge UI deploy-testnet/deploy-mainnet tasks and update Cloudflare Build trigger.
17. Add unified `mainnet` GitHub Actions release workflow for API, indexer, validation, and UI.
18. Update Bridge UI Actions API selection.
19. Update Bridge CLI config/routes/tests/doctor.
20. Update Bridge SDK examples/manual read-only config/docs.
21. Make SDK history constants network-aware for testnet-only legacy values.
22. Update Zeko skill references and docs.
23. Run automated validation.
24. Commit, push the branch, and open a PR after validation completes.
25. After review, merge to `main` so existing Cloudflare Build/Northflank automation can deploy testnet resources and validate testnet domains.
26. After review, run the unified mainnet GitHub Actions workflow and validate mainnet domains.

## Validation Plan

Automated validation should include:

```bash
moon run actions-api:test
moon run actions-api:typecheck
moon run actions-api:lint
moon run actions-indexer:test
moon run actions-indexer:typecheck
moon run actions-indexer:lint
moon run bridge-cli:test
moon run bridge-cli:typecheck
moon run bridge-cli:lint
moon run bridge-sdk:test
moon run bridge-sdk:typecheck
moon run bridge-sdk:lint
moon run bridge-ui:test-ci
moon run bridge-ui:typecheck
moon run bridge-ui:lint
```

Post-deploy service validation:

```bash
curl -fsS https://testnet.api.actions.zeko.io/health
curl -fsS https://api.actions.zeko.io/health
curl -fsS https://testnet.indexer.actions.zeko.io/health
curl -fsS https://indexer.actions.zeko.io/health
moon exec --ignore-ci-checks actions-api:live-e2e-testnet -f
moon exec --ignore-ci-checks actions-api:live-e2e-mainnet -f
moon run actions-indexer:diagnose-health -- --url https://testnet.indexer.actions.zeko.io --timeout-ms 30000
moon run actions-indexer:diagnose-health -- --url https://indexer.actions.zeko.io --timeout-ms 30000
```

Bridge UI smoke checks:

- `https://alpha.bridge.zeko.io` loads the alpha/staging Bridge UI code channel.
- `https://bridge.zeko.io` loads the mainnet Bridge UI after the unified mainnet GitHub Actions workflow deploys it.

After mainnet services are deployed, add a mainnet-specific smoke query using a known action-state range or aux from the mainnet archive.

The only test category excluded from automation is mainnet testing that requires a funded wallet or spends real funds. Humans will run funded mainnet bridge tests.

## Implementation Review Log

Record every implementation action, decision, command choice, or file edit that was not explicitly specified above. This is for reviewability: the PR reviewer should not have to infer why extra work happened.

Initial log:

- Chose `apps/bridge-ui/deploy-ci.nu` as the Nushell replacement for the old Bridge UI deploy shell script.
- Chose three dry-run-first Nushell helper script names under `scripts/mainnet-readiness/`: `provision-actions-mainnet.nu`, `plan-northflank-mainnet.nu`, and `plan-github-mainnet-secrets.nu`.
- Used a 40-character SHA-256 branch hash for Bridge UI preview Sentry environments because Nushell 0.112.2 provides `hash sha256` and `hash md5`, but not `hash sha1`.
- Northflank CLI is not installed in this worktree, so the mainnet pipeline trigger was derived from Northflank's documented release-flow API endpoint: `POST /v1/projects/{projectId}/pipelines/{pipelineId}/release-flows/{stage}/runs`.
- Used explicit `__MAINNET_REVIEW_REQUIRED_HYPERDRIVE_*__` placeholder IDs in top-level Actions API Wrangler config so reviewers can ctrl+f the mainnet Hyperdrive IDs that must come from reviewed provisioning before any mainnet deploy.
- Kept checked-in Actions API Workers Build deploy commands live for testnet and preview; testnet deploy ownership remains Cloudflare Build, not GitHub Actions.
- Added concrete `actions-api:typecheck` and `actions-api:test` Moon tasks because the plan requires these validation targets and `moon run actions-api:typecheck` / `moon run actions-api:test` previously resolved as no-op tasks.
- Kept Actions API local database support with a narrow local-env adapter in `services/actions/api/src/db.ts` because generated Wrangler production/testnet Env types intentionally no longer expose `DATABASE_URL`.
- Scoped `actions-api:test` to the existing `vitest.node.config.ts` so deployed-service live checks remain in the explicit `live-e2e-testnet` and `live-e2e-mainnet` tasks and the local database unit tests avoid the Cloudflare worker-pool stream cleanup issue.
- Updated `northflank/actions-indexer/project.json` with a structured JSON rewrite to avoid hand-editing the large template. The rewrite keeps the existing deployment ref as testnet, adds a mainnet deployment ref, and passes `BRANCH`/`SHA` as release-flow arguments for the mainnet API-triggered run.
- Restored the `actions-indexer:test` Moon task to run the full Vitest suite. If a test needs infrastructure or setup, the fix is to provide that setup or document the review blocker, not exclude the test.
- Updated the `action-processing.runtime.test.ts` Bridge SDK mock to expose `Actions.pushHash`, matching the current SDK import surface used by `src/action-processing/core.ts`.
- Removed the unreviewed `SENTRY_HOST` Wrangler placeholder vars. The Sentry tunnel now derives the allowed ingest host from the existing public Sentry DSN that the deploy flow already requires.
- Expanded `bridge doctor` to print route status, SDK endpoint mapping, and Actions API health checks because the CLI previously only listed route names and could not show whether mainnet/testnet endpoint selection was correct.
- Added a small SDK unit test for network-specific bridge deploy blocks because the previous single `BRIDGE_DEPLOY_BLOCK` export made the testnet cutoff easy to reuse accidentally on mainnet.
- Kept docs-site bridge links and the Nuxt layer default `zekoBridge` link on `alpha.bridge.zeko.io`; the Bridge hostname is a code channel, not a network selector.
- Left `docs/BRIDGE_INVALID_WITNESSES_INCIDENT_2026-03-05.md` unchanged because its `api.actions.zeko.io` references are historical incident evidence, not current endpoint guidance.
- Added planned `testnet.api.actions.zeko.io/graphql` to the Zeko skill external-link skip list because that endpoint is introduced by this PR and will not resolve until after reviewed DNS/deploy cutover.
- Corrected a bad intermediate CI fix that disabled the old Cloudflare Build preview deploy tasks with `echo` commands. Preview deploy tasks remain real preview uploads and now target the testnet Wrangler env so PR branch previews do not touch mainnet config or placeholder mainnet infra.
- Removed `scripts/run-proto-nu.sh`. Cloudflare Builds bootstrap proto/Nushell in `apps/bridge-ui/workers-build.jsonc`; repo Moon deploy tasks invoke `proto run nu -- ./deploy-ci.nu` directly.
- Removed the Bridge UI mainnet wallet block. `bridge.zeko.io` and `alpha.bridge.zeko.io` are code channels, and the Bridge machine now accepts Mina/Zeko mainnet and testnet networks.
- Kept `SENTRY_PROJECT` optional in `apps/bridge-ui/deploy-ci.nu`, defaulting to the historical `zeko-bridge` project slug, because the old shell deploy path hardcoded that slug and did not require a runtime `SENTRY_PROJECT` build variable.
