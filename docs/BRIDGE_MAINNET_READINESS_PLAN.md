# Bridge Mainnet Readiness Implementation Plan

Date: 2026-05-21

Baseline:

- Branch: `branch/filter-legacy-bridge-operations`
- Merge baseline: `40dae9a` (`origin/main` merged after SDK module refactor)
- Scope: Actions API, Actions indexer, Actions database, Bridge UI, Bridge CLI, Bridge SDK examples/docs, deployment workflows, and validation

This document is the single source of truth for implementation. It is written for an implementation agent that does not have the surrounding conversation.

## Target Outcome

Ship one PR that makes the bridge stack mainnet-ready while preserving testnet.

| Environment | Actions API                   | Actions Indexer                   | Actions DB                    | Bridge UI                                                  | Deployment owner                                        |
| ----------- | ----------------------------- | --------------------------------- | ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| testnet     | `testnet.api.actions.zeko.io` | `testnet.indexer.actions.zeko.io` | current `actions` Supabase DB | `testnet.bridge.zeko.io` with `alpha.bridge.zeko.io` alias | auto-deploy from `main`                                 |
| mainnet     | `api.actions.zeko.io`         | `indexer.actions.zeko.io`         | fresh Supabase DB             | production code channel at `bridge.zeko.io`                | one GitHub Actions workflow using environment `mainnet` |

Current `api.actions.zeko.io` serves testnet traffic. Cutover means:

1. Stand up `testnet.api.actions.zeko.io` against the current DB.
2. Move testnet consumers to that hostname.
3. Provision and validate the fresh mainnet DB, indexer, API, and UI.
4. Move `api.actions.zeko.io` to mainnet.

Domain rules:

- `alpha` and `testnet` share the testnet infrastructure environment.
- Do not create a separate alpha stack.
- Treat `testnet.bridge.zeko.io` as the primary testnet Bridge UI code channel.
- Treat `alpha.bridge.zeko.io` as an alias for that testnet Bridge UI code channel.
- Bridge hostnames select the deployed code channel, not the user's bridge network. Both `bridge.zeko.io` and the testnet Bridge UI hostnames must be capable of selecting supported testnet and mainnet routes.
- Normalize old alphanet/testnet config distinctions so alpha is described as a testnet alias, not a third infrastructure environment.

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
live-e2e-testnet: vitest run tests/actions.live-e2e.test.ts
live-e2e-mainnet: vitest run tests/actions.live-e2e.test.ts
```

Set the live e2e task endpoint with Moon `env`, not inline shell.

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
- one mainnet pipeline stage/release flow (`Production`, because Northflank pipeline stage names are constrained to `Development`, `Staging`, or `Production`) that is not human-triggered directly; GitHub Actions triggers it as part of the single mainnet release workflow
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
- `L1_ARCHIVE_URL`: `https://gateway.mina.archive.mainnet.zeko.io`
- `L2_ARCHIVE_URL`: `https://archive.mainnet.zeko.io/graphql`
- `OUTER_PK`: `B62qm46jqHb9HAYiyGJeYkWgqNtPQEiTcssuoiua8VvKJGDStFsRcyC`
- `INNER_PK`: `B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`
- `ENVIRONMENT`: `mainnet`

Northflank invocation requirement:

- Use Northflank's release-flow API endpoint for triggering the mainnet `Production` pipeline stage from GitHub Actions:

```bash
curl -fsS -X POST "https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/pipelines/${NORTHFLANK_PIPELINE_ID}/release-flows/${NORTHFLANK_STAGE:-Production}/runs" \
  -H "Authorization: Bearer ${NORTHFLANK_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"name\":\"Bridge mainnet release ${GITHUB_RUN_NUMBER}\",\"description\":\"Triggered by ${GITHUB_REPOSITORY} sha ${GITHUB_SHA}\",\"overrides\":{\"actions-indexer-mainnet-pipeline-build\":{\"branch\":\"${GITHUB_REF_NAME}\",\"sha\":\"${GITHUB_SHA}\"}}}"
```

- Provide `NORTHFLANK_TOKEN`, `NORTHFLANK_PROJECT_ID`, and `NORTHFLANK_PIPELINE_ID` in the GitHub `mainnet` environment; `NORTHFLANK_STAGE` may override the default `Production` stage name if review chooses a different stage slug accepted by Northflank.
- Encode this invocation in the reviewed workflow and/or Nushell helper script.
- Do not leave the workflow with a placeholder command.
- Record the discovery path and final command in the Implementation Review Log.

## Bridge UI Deployment

Update `apps/bridge-ui/wrangler.jsonc`:

- Top-level/default config is mainnet:
  - route `bridge.zeko.io`
- `env.testnet` is the testnet code channel:
  - route `testnet.bridge.zeko.io`
  - route `alpha.bridge.zeko.io` as an alias
- Neither testnet route must be attached to the production/mainnet default config.

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

Replace `apps/bridge-ui/deploy-ci.sh` with a Nushell entrypoint, for example `apps/bridge-ui/deploy-ci.nu`. Cloudflare Builds install the pinned proto/Nushell toolchain in their checked-in build command, and Moon tasks invoke `nu ./deploy-ci.nu` without wrapping commands in `proto run`.

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
  - deploy routes `testnet.bridge.zeko.io` and `alpha.bridge.zeko.io`
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
deploy-testnet: BRIDGE_UI_DEPLOY_TARGET=testnet nu ./deploy-ci.nu
deploy-mainnet: BRIDGE_UI_DEPLOY_TARGET=mainnet nu ./deploy-ci.nu
deploy-preview: BRIDGE_UI_DEPLOY_TARGET=preview nu ./deploy-ci.nu
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
- Cloudflare Build deploys the Bridge UI testnet code channel only by invoking `bridge-ui:deploy-testnet`.
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
- Testnet Bridge UI is `https://testnet.bridge.zeko.io`.
- Alpha Bridge UI is `https://alpha.bridge.zeko.io`, an alias for the testnet Bridge UI code channel.
- Mainnet Bridge UI is `https://bridge.zeko.io`.
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
moon run actions-api:manual-db-test
moon run actions-api:typecheck
moon run actions-api:lint
moon run actions-indexer:test-service-integration
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

- `https://testnet.bridge.zeko.io` loads the testnet Bridge UI code channel.
- `https://alpha.bridge.zeko.io` loads the same testnet Bridge UI code channel as an alias.
- `https://bridge.zeko.io` loads the mainnet Bridge UI after the unified mainnet GitHub Actions workflow deploys it.

After mainnet services are deployed, add a mainnet-specific smoke query using a known action-state range or aux from the mainnet archive.

The only test category excluded from automation is mainnet testing that requires a funded wallet or spends real funds. Humans will run funded mainnet bridge tests.

## Deployment Access Inventory

This is the review-time inventory of credentials, environment variables, and service access needed before deployment can start. Do not run deployment or provisioning commands until this PR has been reviewed and the remaining placeholder values have been replaced through the reviewed scripts.

Required operator access:

- GitHub maintainer access to `zeko-labs/zeko-ui` for creating the protected `mainnet` environment, writing environment secrets/variables, running the mainnet release workflow, and resolving PR review threads.
- Cloudflare account access for Workers Builds, Workers deploys, route/DNS cutover, and Hyperdrive creation in the Zeko account.
- Supabase organization access for creating the `actions-mainnet` project and reading its final database connection string.
- Northflank access to the Actions Indexer project, template, and pipeline release flow.
- Sentry organization/project access for release creation, deploy registration, and sourcemap upload.

Local or CI tooling required:

- `pnpm`, `moon`, `nu`, `gh`, and `wrangler` for repository workflows and reviewed helper scripts.
- `sentry-cli` for Bridge UI release and sourcemap deployment.
- Cloudflare Builds must install `nu` through proto before running the Bridge UI deploy script.
- The reviewed Cloudflare Workers Build trigger sync command is `CLOUDFLARE_API_TOKEN="$CFB_TOKEN" CLOUDFLARE_ACCOUNT_ID="a12d2915bc16ee8550f19399839623f7" moon run bridge-ui:publish-cf-build-config`.

GitHub `mainnet` environment inputs:

- Environment secrets: `ACTIONS_MAINNET_DATABASE_URL`, `NORTHFLANK_TOKEN`, `SENTRY_AUTH_TOKEN`, `SENTRY_DSN_PUBLIC`, and `SENTRY_ORG`.
- Repository secrets already provide `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; do not duplicate them into the `mainnet` environment unless review explicitly chooses environment-scoped Cloudflare credentials.
- Variables: `NORTHFLANK_PROJECT_ID`, `NORTHFLANK_PIPELINE_ID`, `NORTHFLANK_STAGE`, and `SENTRY_PROJECT`.
- The reviewable command plan is generated by `scripts/mainnet-readiness/plan-github-mainnet-secrets.nu`; use `--execute` only after the values above have been reviewed.

Actions API mainnet database and Cloudflare inputs:

- `SUPABASE_ORG_ID`, `ACTIONS_MAINNET_DB_PASSWORD`, `SUPABASE_SIZE=medium`, and optional `SUPABASE_REGION` are required for the first `scripts/mainnet-readiness/provision-actions-mainnet.nu` pass. `medium` matches the current testnet Actions Supabase project compute addon, discovered from the Supabase Management API `GET /v1/projects/rvzghxcdyzeulearzlem/billing/addons` response (`ci_medium`, 2 CPU, 4 GB RAM). The helper script must still read this as an explicit environment variable instead of silently defaulting it.
- After the Supabase project exists, derive and review `ACTIONS_MAINNET_DATABASE_URL`, then rerun the script to store that URL in the GitHub `mainnet` environment and create the cached/no-cache Cloudflare Hyperdrive resources.
- After Hyperdrive creation, replace `__MAINNET_REVIEW_REQUIRED_HYPERDRIVE_CACHE_ID__` and `__MAINNET_REVIEW_REQUIRED_HYPERDRIVE_NO_CACHE_ID__` in `services/actions/api/wrangler.jsonc`.

Northflank mainnet inputs:

- GitHub Actions must provide `NORTHFLANK_TOKEN`, `NORTHFLANK_PROJECT_ID`, `NORTHFLANK_PIPELINE_ID`, `NORTHFLANK_STAGE`, `GITHUB_SHA`, `GITHUB_REF_NAME`, `GITHUB_RUN_NUMBER`, and `GITHUB_REPOSITORY`.
- Northflank template arguments must be configured with `MAINNET_DATABASE_URL`, `MAINNET_AUTH_TOKEN`, `MAINNET_L1_ARCHIVE_URL`, `MAINNET_L2_ARCHIVE_URL`, `MAINNET_OUTER_PK`, `MAINNET_INNER_PK`, `MAINNET_L1_FINALITY`, and `MAINNET_L2_FINALITY_TIME_H`.
- Mainnet archive defaults for review: `MAINNET_L1_ARCHIVE_URL=https://gateway.mina.archive.mainnet.zeko.io`, `MAINNET_L2_ARCHIVE_URL=https://archive.mainnet.zeko.io/graphql`, `MAINNET_OUTER_PK=B62qm46jqHb9HAYiyGJeYkWgqNtPQEiTcssuoiua8VvKJGDStFsRcyC`, and `MAINNET_INNER_PK=B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`.
- The reviewable release-flow request is generated by `scripts/mainnet-readiness/plan-northflank-mainnet.nu`; use `--execute` only after the Northflank template values above have been reviewed.

Known deployment blockers before review:

- `https://testnet.bridge.zeko.io` and `https://testnet.api.actions.zeko.io/graphql` are planned endpoints introduced by this PR. Link checks skip them until reviewed DNS/deploy cutover makes them live.
- The Bridge UI Workers Build PR check is blocked until the checked-in `apps/bridge-ui/workers-build.jsonc` is reviewed and synced to Cloudflare. The current remote trigger still runs the old deploy command without the proto `nu` install path, so it fails with `nu: command not found`.
- Mainnet Actions API deploy is blocked until the reviewed Hyperdrive IDs replace the `__MAINNET_REVIEW_REQUIRED_HYPERDRIVE_*__` placeholders.
- Mainnet release workflow execution is blocked until the GitHub `mainnet` environment secrets and variables above are present.
- Local `.env` now contains `SENTRY_DSN_PUBLIC`; the reviewed GitHub `mainnet` environment still needs the same DSN stored as an environment secret before workflow execution.

## Implementation Review Log

This section is the written log requested for everything done during implementation that was not explicitly specified above.

Record every implementation action, decision, command choice, or file edit that was not explicitly specified above. This is for reviewability: the PR reviewer should not have to infer why extra work happened.

Initial log:

- Chose `apps/bridge-ui/deploy-ci.nu` as the Nushell replacement for the old Bridge UI deploy shell script.
- Chose three dry-run-first Nushell helper script names under `scripts/mainnet-readiness/`: `provision-actions-mainnet.nu`, `plan-northflank-mainnet.nu`, and `plan-github-mainnet-secrets.nu`.
- Used a 40-character SHA-256 branch hash for Bridge UI preview Sentry environments because Nushell 0.112.2 provides `hash sha256` and `hash md5`, but not `hash sha1`.
- Northflank CLI is not installed in this worktree, so the mainnet pipeline trigger was derived from Northflank's documented release-flow API endpoint: `POST /v1/projects/{projectId}/pipelines/{pipelineId}/release-flows/{stage}/runs`.
- Used explicit `__MAINNET_REVIEW_REQUIRED_HYPERDRIVE_*__` placeholder IDs in top-level Actions API Wrangler config so reviewers can ctrl+f the mainnet Hyperdrive IDs that must come from reviewed provisioning before any mainnet deploy.
- Kept checked-in Actions API Workers Build deploy commands live for testnet and preview; testnet deploy ownership remains Cloudflare Build, not GitHub Actions.
- Added a concrete `actions-api:typecheck` Moon task because the plan requires that validation target and `moon run actions-api:typecheck` previously resolved as a no-op task.
- Modeled the new `actions-api:live-e2e-*` tasks with Moon `command`, `args`, and `env` fields rather than inline shell so the live endpoint selection is reviewable in structured task config.
- Reverted `services/actions/api/src/db.ts` to match `origin/main`; changing Actions API database initialization is outside this plan.
- Did not add inline Docker orchestration to `services/actions/api/moon.yml`; local DB setup remains in the existing explicit `manual-db-test` task.
- Updated `northflank/actions-indexer/project.json` to keep the existing deployment ref as testnet and add a mainnet deployment ref. The mainnet release flow defaults to branch `main`; GitHub Actions supplies branch/SHA selection through Northflank release-flow `overrides`, not checked-in template arguments.
- Corrected the Northflank pipeline stage names to API-accepted values after live template validation rejected `Testnet` and `Mainnet`; testnet maps to `Development`, and mainnet maps to `Production`.
- Left `services/actions/indexer/moon.yml` unchanged from `origin/main`; indexer test harness changes are outside this plan.
- Left `services/actions/indexer/src/action-processing/runtime.ts` unchanged from `origin/main`; action-processing process resolution changes are outside this plan.
- Removed the unreviewed `SENTRY_HOST` Wrangler placeholder vars. The Sentry tunnel derives the allowed ingest host from the existing public Sentry DSN so the PR does not invent a new Wrangler variable. This is the only retained `server/routes/tunnel.ts` change.
- Expanded `bridge doctor` to print route status, SDK endpoint mapping, and Actions API health checks because the CLI previously only listed route names and could not show whether mainnet/testnet endpoint selection was correct.
- Added a small SDK unit test for network-specific bridge deploy blocks because the previous single `BRIDGE_DEPLOY_BLOCK` export made the testnet cutoff easy to reuse accidentally on mainnet.
- Kept docs-site bridge links and the Nuxt layer default `zekoBridge` link on `testnet.bridge.zeko.io`; `alpha.bridge.zeko.io` remains documented as the testnet alias.
- Left `docs/BRIDGE_INVALID_WITNESSES_INCIDENT_2026-03-05.md` unchanged because its `api.actions.zeko.io` references are historical incident evidence, not current endpoint guidance.
- Added planned `testnet.api.actions.zeko.io/graphql` and `testnet.bridge.zeko.io` to external-link skip lists because those endpoints are introduced by this PR and will not resolve until after reviewed DNS/deploy cutover.
- Corrected a bad intermediate CI fix that disabled the old Cloudflare Build preview deploy tasks with `echo` commands. Preview deploy tasks remain real preview uploads and now target the testnet Wrangler env so PR branch previews do not touch mainnet config or placeholder mainnet infra.
- Removed `scripts/run-proto-nu.sh`. Cloudflare Builds bootstrap proto/Nushell in `apps/bridge-ui/workers-build.jsonc`; repo Moon deploy tasks invoke `nu ./deploy-ci.nu` directly.
- Removed the Bridge UI mainnet wallet block. Bridge hostnames are code channels, and the Bridge machine now accepts Mina/Zeko-M mainnet and testnet networks.
- Kept `SENTRY_PROJECT` optional in `apps/bridge-ui/deploy-ci.nu`, defaulting to the historical `zeko-bridge` project slug, because the old shell deploy path hardcoded that slug and did not require a runtime `SENTRY_PROJECT` build variable.
- Added explicit Bridge UI deploy-script exit checks after every external build, Sentry, and Wrangler command because Nushell external commands do not fail the script unless `$env.LAST_EXIT_CODE` is inspected.
- Changed Bridge UI preview branch hashing to `hash sha256 | encode hex | str substring 0..39` so the reviewable preview environment name is deterministic text instead of relying on raw binary hash output.
- Replaced deploy-script PATH string interpolation with list-aware PATH extension using `char esep` and `path join`.
- Added this Deployment Access Inventory so deployment can start from a known list of required credentials, service access, placeholders, and review blockers.
- Investigated the failing Cloudflare Workers Build PR check with the `CFB_TOKEN` API token. The build log shows the remote trigger still runs the old deploy command and fails with `nu: command not found`; `cloudflare-build-config:sync-dry-run` reports that both Bridge Workers Build triggers would be updated by the checked-in config.
- Corrected `plan-github-mainnet-secrets.nu` so it reads secret and variable values from environment variables instead of writing the variable names as GitHub secret values.
- Corrected `plan-github-mainnet-secrets.nu`, `plan-northflank-mainnet.nu`, and `provision-actions-mainnet.nu` so dry-run output references shell environment variables instead of printing secret values into logs.
- Split `provision-actions-mainnet.nu` into a safe first pass for Supabase project creation and a second pass for GitHub secret/Hyperdrive creation after the reviewed mainnet database URL is available.
- Corrected `plan-github-mainnet-secrets.nu` to rely on existing repository-level Cloudflare secrets instead of requiring duplicate `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` environment secrets.
- Removed the unchecked `small` Supabase compute-size default from `provision-actions-mainnet.nu`; `SUPABASE_SIZE` is now an explicit reviewed input.
- Corrected the mainnet Actions Indexer `INNER_PK` plan value to reuse the testnet inner key, `B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`, after operator clarification.
- Confirmed local `.env` contains `SENTRY_DSN_PUBLIC`; Sentry DSN is no longer a local discovery blocker, but it still must be written to the reviewed GitHub `mainnet` environment secret before running the mainnet workflow.
- Removed local fallback values for `GITHUB_REF_NAME`, `GITHUB_SHA`, `GITHUB_RUN_NUMBER`, and `GITHUB_REPOSITORY` from the Northflank release-flow helper; GitHub Actions must provide them, and local dry-runs must pass explicit values.
- Discovered the current testnet Actions Supabase compute size through the Supabase Management API billing addons endpoint: selected addon `compute_instance`, variant `ci_medium`, CLI project creation size `medium`.
- Renamed the planned Northflank GitHub environment secret from `NORTHFLANK_API_TOKEN` to `NORTHFLANK_TOKEN` to match the provided local `.env` key and verified that token shape against the Northflank project API without printing the token.
- Added `services/actions/api/.dev.vars` with non-secret local development values so `wrangler types` preserves the local `ENVIRONMENT=local`/`DATABASE_URL` contract while generated deployment envs still reflect testnet/mainnet Wrangler config.
- Corrected `services/actions/api/.env.example` to use lowercase `ENVIRONMENT="local"`, matching the existing `db.ts` runtime check.
- After operator confirmation to proceed on 2026-05-27, used PR head `6511443e03f8ce306e2f7a98a1f7b8ae61e01690` as the release point even though GitHub still reported PR review state `REVIEW_REQUIRED`.
- Created the Supabase mainnet Actions project `actions-mainnet` in org `sgiauboxfyybzczucvgd`, region `eu-central-1`, size `medium`; Supabase returned project ref `yfmzqqkzxsdktrrivlhn`.
- Generated local `ACTIONS_MAINNET_DB_PASSWORD` and `MAINNET_AUTH_TOKEN` in ignored `.env.mainnet-readiness.local`; the generated password required URL encoding before use in PostgreSQL connection URLs.
- Created the GitHub `mainnet` environment with no protection rules via `gh api --method PUT repos/zeko-labs/zeko-ui/environments/mainnet`, then set environment secrets/vars from the reviewed root `.env` mapping. If required reviewers are wanted, that remains an explicit GitHub environment settings follow-up.
- Corrected `ACTIONS_MAINNET_DATABASE_URL` after initial GitHub secret setup so the final GitHub `mainnet` environment secret uses the URL-encoded database password.
- Confirmed the Cloudflare Workers Builds token `CFB_TOKEN` can verify and sync Workers Build config, but Wrangler Hyperdrive API calls return Cloudflare authentication error with that token. Used the existing local Wrangler OAuth login for Hyperdrive list/create operations.
- Created Cloudflare Hyperdrive config `actions-mainnet-db-cache` with ID `9d11060dc2af499d897f52c8d3a7c74f`.
- Created Cloudflare Hyperdrive config `actions-mainnet-db-no-cache` with ID `e674c005e43c4d45ac622e987294c51d`.
- Replaced the mainnet Hyperdrive placeholders in `services/actions/api/wrangler.jsonc` with the reviewed IDs and validated with `moon run actions-api:type-cf -f`, `moon run actions-api:typecheck -f`, and `moon run actions-api:lint -f`.
- The live Northflank project still had the old `Development`/`Staging`/`Production` pipeline and no mainnet deployment, so the checked-in template needed to be applied before the mainnet release flow could run.
- Northflank template schema validation rejected checked-in stage names `Testnet` and `Mainnet`; corrected the template and workflow defaults so testnet maps to `Development` and mainnet maps to `Production`.
- Northflank accepted the corrected template schema, but the live template run failed because `testnet.indexer.actions.zeko.io` was not verified in Northflank. Added the subdomain in Northflank; verification still requires a Cloudflare DNS CNAME for `testnet.indexer.actions.zeko.io` pointing at `testnet.indexer.actions.zeko.io.zeko-t5vf.dns.northflank.app`.
- The available `CFB_TOKEN` can verify and list the `zeko.io` zone but initially returned Cloudflare authentication errors for DNS record read/write. After the token permissions were corrected, created the unproxied `testnet.indexer.actions.zeko.io` CNAME pointing at `testnet.indexer.actions.zeko.io.zeko-t5vf.dns.northflank.app`, verified it through Cloudflare DNS, and verified the subdomain in Northflank.
- Applied the corrected Northflank template through template run `2b2f6555-25eb-46e7-a700-d7d5fb19fbf8`; the run completed successfully.
- Ran the mainnet Actions API database migrations with `moon exec --ignore-ci-checks actions-api:db-migrate -- --force`; migrations completed successfully.
- Deployed the mainnet Actions API. The token-backed Wrangler deploy uploaded the worker but failed on the route update; rerunning the final deploy through the existing local Wrangler OAuth session succeeded with version `43348e31-58a5-41ef-901d-68fb3fdb0a08`.
- Triggered the Northflank `Production` release flow for the mainnet Actions indexer with branch `branch/bridge-mainnet-readiness-plan` and SHA `7dae5e173300c0462b60c291e9ecf907458710cb`; release flow run `930d259f-608b-436c-a5a9-2f92add76bb8` completed successfully.
- The first Northflank release-flow trigger failed because descriptions reject `@`. Updated the workflow, helper script, and documented curl command to use `sha` in the description text instead.
- The mainnet indexer initially failed health checks because the direct Supabase host resolved without an IPv4 `A` record in this environment. Updated the live Northflank deployment and stored template argument to use the Supabase pooler host `aws-1-eu-central-1.pooler.supabase.com:5432`; the indexer then reported healthy.
- Validated mainnet Actions with `moon exec --ignore-ci-checks actions-api:live-e2e-mainnet -f` and `moon run actions-indexer:diagnose-health -- --url https://indexer.actions.zeko.io --timeout-ms 30000 --json`; both passed.
- Published the checked-in Bridge Workers Build config with `moon run bridge-ui:publish-cf-build-config -f`; Cloudflare reported default-branch and non-production trigger updates.
- GitHub cannot dispatch `.github/workflows/bridge-mainnet-release.yaml` from this feature branch because the workflow is not on the default branch yet, so Bridge UI mainnet deployment was run locally with the same deploy task inputs.
- The Bridge UI deploy script failed under the current Nushell version because the PATH list used `path join` without pipeline input. Rewrote the two PATH entries to pipe `pwd` into `path join`, then validated the script parse and reran the deploy.
- Deployed the mainnet Bridge UI. The token-backed deploy uploaded assets but failed on the route update; rerunning the final Wrangler deploy through the existing local Wrangler OAuth session succeeded with version `1ee2afc1-1042-46ae-8390-e3d5de4c3360`, then finalized the Sentry release.
- Smoke checks after deployment returned healthy responses from `https://bridge.zeko.io`, `https://api.actions.zeko.io/health`, and `https://indexer.actions.zeko.io/health`.
- Explicitly verified testnet/mainnet separation after mainnet deploy. The checked-in Bridge UI deploy targets map testnet to `wrangler deploy --env testnet` and mainnet to default `wrangler deploy`; Bridge UI and Bridge CLI endpoint config map testnet Actions reads to `https://testnet.api.actions.zeko.io/graphql` and mainnet Actions reads to `https://api.actions.zeko.io/graphql`.
- Deployed the testnet Actions API through `moon exec --ignore-ci-checks actions-api:deploy-testnet` using the existing local Wrangler OAuth session. The deploy created `testnet.api.actions.zeko.io` and version `246a3f8f-29ed-4828-82c2-1e470ded9885`; `moon exec --ignore-ci-checks actions-api:live-e2e-testnet -f` passed.
- Deployed the testnet Bridge UI through `moon exec --ignore-ci-checks bridge-ui:deploy-testnet` using the existing local Wrangler OAuth session. The deploy created `testnet.bridge.zeko.io` and `alpha.bridge.zeko.io` and version `2ba978e4-8635-439b-a906-7306b5fc1e24`.
- Triggered the Northflank `Development` release flow for the testnet Actions indexer after finding the deployment service had no released container. Release-flow run `fdfa4e7e-e9a7-419c-89d2-155dbebda942` completed successfully and released build `stunning-linen-1859` for SHA `5297d8ac20f66f18347d6f0e193fd51c7fc6c65d`.
- Validated the testnet indexer with `moon run actions-indexer:diagnose-health -- --url https://testnet.indexer.actions.zeko.io --timeout-ms 30000 --json`; it reported healthy with service environment `testnet`.
- Verified authoritative Cloudflare DNS has distinct proxied Worker custom-domain records for `testnet.bridge.zeko.io`, `alpha.bridge.zeko.io`, `testnet.api.actions.zeko.io`, `bridge.zeko.io`, and `api.actions.zeko.io`. The local macOS resolver still had inconsistent fresh-record resolution immediately after creation, but direct Cloudflare-path checks and authoritative DNS confirmed the testnet Worker routes were present and separate.
