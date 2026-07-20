---
id: T478
title: "simplify-bridge-operation-hash-cell"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-20T10:34:12Z
updated_at: 2026-07-20T10:36:00Z
---
## Requirements

- Address review feedback in `apps/bridge-ui/app/components/BridgeOperations.vue`.
- Use `row.original.hash` in the hash cell instead of repeated `String(row.getValue("hash"))` casts/fallbacks.
- Keep current user-visible behavior unchanged: empty hashes show `none`, copy/check feedback still works, explorer links still use the row data.
- Do not push.

## Test Plan

- Test Strategy Exception: this is a template readability refactor with no intended behavior change; existing bridge operations table tests cover row mapping/status behavior and typecheck covers template typing.
- Validate with targeted bridge operations table tests, typecheck, lint, and format.

## RED Evidence

- Test Strategy Exception recorded before source edits.

## GREEN Evidence

- Replaced repeated hash-cell `row.getValue("hash")` casts with typed `row.original.hash` in `BridgeOperations.vue`.
- Updated the existing source-text test to assert the template uses `row.original.hash`.
- `nix develop --command pnpm exec moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operations-table.test.ts` passed.
- `nix develop --command pnpm exec moon run bridge-ui:typecheck -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:lint -f` passed.
- `nix develop --command pnpm exec moon run bridge-ui:format-fix -f` then `nix develop --command pnpm exec moon run bridge-ui:format -f` passed.
