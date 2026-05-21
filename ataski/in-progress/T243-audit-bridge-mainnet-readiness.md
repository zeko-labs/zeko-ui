---
id: T243
title: "audit-bridge-mainnet-readiness"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-21T07:51:03Z
updated_at: 2026-05-21T07:53:14Z
---
## Requirements

- Audit bridge-sdk, bridge-sdk examples, bridge-cli, bridge-ui config references, and actions-api/actions-indexer configuration for `mina:mainnet <=> zeko:mainnet` readiness.
- Do not run live bridge commands, submit transactions, or perform any value-moving test.
- Treat Actions API/indexer readiness as part of bridge readiness because SDK/CLI status and witness paths depend on `actionsApi`.
- Identify whether mainnet routes can be enabled now or must remain disabled until a separate mainnet Actions API/indexer deployment/config exists.
- Record concrete file-level evidence for every blocker or readiness claim.

## Test Plan

- DDD. This is an audit task: inspect source/config/docs and record findings before implementation.
- No RED test is required for this task because it does not change source behavior.
- Completion evidence is a written audit summary in this task file and an explicit go/no-go recommendation for implementation.

## RED Evidence

## GREEN Evidence
