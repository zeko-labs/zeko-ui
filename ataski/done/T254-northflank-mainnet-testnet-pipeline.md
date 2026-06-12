---
id: T254
title: "Northflank mainnet testnet pipeline"
status: done
blockedBy: [T252]
owner: codex
created_at: 2026-05-21T10:40:00Z
updated_at: 2026-05-21T11:06:32Z
---

## Requirements

- Update `northflank/actions-indexer/project.json` to model one project with one shared build service and two deployment services: testnet and mainnet.
- Rename/model the existing live deployment as testnet and expose it at `testnet.indexer.actions.zeko.io` without replacing it with an unrelated service.
- Add mainnet deployment at `indexer.actions.zeko.io`.
- Use Northflank pipelines and release flows, not Northflank Environments/workflows.
- Keep secrets and concrete values out of the template; use template args, secure overrides, secret groups, or pipeline-stage arguments/variables.
- Required runtime vars per deployment: `DATABASE_URL`, `AUTH_TOKEN`, `PORT`, `L1_ARCHIVE_URL`, `L2_ARCHIVE_URL`, `OUTER_PK`, `INNER_PK`, `ENVIRONMENT`; optional `L1_FINALITY`, `L2_FINALITY_TIME_H`.
- Mainnet values: `L1_ARCHIVE_URL=https://api.minascan.io/archive/mainnet/v1/graphql`, `L2_ARCHIVE_URL=https://archive.mainnet.zeko.io/graphql`, `OUTER_PK=B62qm46jqHb9HAYiyGJeYkWgqNtPQEiTcssuoiua8VvKJGDStFsRcyC`, `INNER_PK=B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`, `ENVIRONMENT=mainnet`.
- Figure out the exact Northflank CLI/API invocation for triggering the `Mainnet` pipeline stage from GitHub Actions, encode it in the reviewed workflow and/or Nushell helper script, and do not leave a placeholder command.
- Record the discovery path and final Northflank invocation in the Implementation Review Log.

## Test Plan

- TDD: first show the current Northflank template has one deployment service, only the Development stage is populated, and the live-env-required keys are not all represented.
- GREEN validation:
  - JSON/schema validation for `northflank/actions-indexer/project.json`.
  - dry-run/plan output from the relevant Nushell helper.
  - Northflank CLI help/API inspection showing the chosen mainnet pipeline invocation.
  - `moon run actions-indexer:test`
  - `moon run actions-indexer:typecheck`
  - `moon run actions-indexer:lint`

## RED Evidence

Recorded on 2026-05-21:

- Node inspection of `northflank/actions-indexer/project.json` showed one deployment service: ref/name `actions-indexer-deployment` with domain `indexer.actions.zeko.io`.
- The same inspection showed pipeline stages `Development`, `Staging`, and `Production`; only `Development` has one resource, one trigger, and two release-flow steps.
- `ataski/tasks.md` shows `T252` done, so `T254` is unblocked.

## GREEN Evidence

Recorded on 2026-05-21:

- Structured JSON inspection of `northflank/actions-indexer/project.json` showed two deployment services: testnet at `testnet.indexer.actions.zeko.io` and mainnet at `indexer.actions.zeko.io`.
- Structured JSON inspection showed two pipeline stages: `Testnet` with a branch trigger and `Mainnet` with no automatic trigger.
- `proto run nu -- scripts/mainnet-readiness/plan-northflank-mainnet.nu` printed the reviewed release-flow API command:
  `POST https://api.northflank.com/v1/projects/${NORTHFLANK_PROJECT_ID}/pipelines/${NORTHFLANK_PIPELINE_ID}/release-flows/${NORTHFLANK_STAGE:-Mainnet}/runs`
- `moon run actions-indexer:test` passed 7 files / 27 tests.
- `moon run actions-indexer:typecheck` passed.
- `moon run actions-indexer:lint` passed.
