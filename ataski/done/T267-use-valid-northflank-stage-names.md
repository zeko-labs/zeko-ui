---
id: T267
title: "Use valid Northflank stage names"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-27T02:40:00Z
updated_at: 2026-05-27T02:46:00Z
---

## Requirements

- Replace invalid Northflank pipeline stage names with names accepted by the Northflank API.
- Preserve the infrastructure meaning: testnet uses the `Development` stage, mainnet uses the `Production` stage.
- Update workflow/script/docs defaults so the mainnet release flow triggers `Production`.
- Record the API validation failure and the corrected validation evidence.

## Test Plan

- DDD: this change is driven by Northflank API schema validation.
- RED path: Northflank template create rejected `Testnet` and `Mainnet` stage names because stage names must be `Development`, `Staging`, or `Production`.
- GREEN path: update repo config, run format checks, and verify the generated template body is accepted by Northflank.

## RED Evidence

- Northflank `POST /v1/templates` returned validation errors for `spec.spec.steps[1].spec.steps[3].spec.stages[0].name` and `stages[1].name`: stage names must be one of `Development`, `Staging`, or `Production`; received `Testnet` and `Mainnet`.

## GREEN Evidence

- Updated `northflank/actions-indexer/project.json` so testnet uses Northflank stage `Development` and mainnet uses `Production`.
- Updated `.github/workflows/bridge-mainnet-release.yaml` and `scripts/mainnet-readiness/plan-northflank-mainnet.nu` so `NORTHFLANK_STAGE` defaults to `Production`.
- Updated review docs with the accepted stage mapping and the remaining DNS verification blocker.
- `moon run bridge-mainnet-readiness-plan:format -f` passed.
- Northflank accepted the corrected template schema and created a template run; that run then failed at the next infrastructure gate because `testnet.indexer.actions.zeko.io` is not yet DNS-verified.
