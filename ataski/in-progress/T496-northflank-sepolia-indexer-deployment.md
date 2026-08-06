---
id: T496
title: "Add Northflank Sepolia indexer deployment"
status: in-progress
blockedBy: []
owner: unassigned
created_at: 2026-08-06T00:00:00Z
updated_at: 2026-08-06T00:01:00Z
---

## Requirements

- Extend `northflank/actions-indexer/project.json` with a third deployment service ref/name `actions-indexer-sepolia-deployment` in the existing `actions-indexer` project.
- Configure the service for port 3000 and domain `sepolia.indexer.actions.zeko.io`.
- Configure runtime argument references only; never commit database URLs, control tokens, or other secrets.
- Set Sepolia runtime values through template arguments:
  - `ENVIRONMENT=sepolia`
  - `L1_ARCHIVE_URL=https://sepolia-gateway.zeko.io/graphql`
  - `L2_ARCHIVE_URL=https://archive.sepolia.zeko.io/graphql`
  - outer key `B62qpggUSofPZcWqtgbmLVnSAzzjAqSXjyckLJaBeGmXiPnc2mGUfhf`
  - inner key `B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`
- Add the Sepolia deployment to the currently unused `Staging` pipeline stage with an operator-triggered release flow and no automatic VCS trigger.
- Preserve existing testnet/mainnet services, stages, release flows, runtime references, and domains.

## Test Plan

- Strategy: BDD.
- RED: add a focused template contract test that fails because the Sepolia deployment, Staging stage, and Sepolia argument references do not yet exist, while asserting existing testnet/mainnet targets remain intact.
- GREEN: implement the template changes and run the focused contract test plus JSON/template validation and relevant indexer checks.
- Live Northflank template application, DNS, release, and health validation are operator handoff steps after repository GREEN validation.

## RED Evidence

- `cd services/actions/indexer && node_modules/.bin/vitest run test/northflank-template.test.ts` failed before implementation: all three contract assertions failed because the Sepolia deployment and `Staging` stage were absent; the existing pipeline target assertions also lacked the expected pipeline structure in the initial test shape and will be corrected as part of the focused harness.

## GREEN Evidence

- `cd services/actions/indexer && node_modules/.bin/vitest run test/northflank-template.test.ts` passed: 3 tests.
- `cd services/actions/indexer && node_modules/.bin/tsgo --noEmit --declaration false --declarationMap false -p tsconfig.json` passed.
- `node_modules/.bin/biome check --formatter-enabled=false services/actions/indexer/test/northflank-template.test.ts` passed.
- `node -e 'JSON.parse(require("fs").readFileSync("northflank/actions-indexer/project.json", "utf8"))'` passed.
- `git diff --check` passed.

## Completion Notes
