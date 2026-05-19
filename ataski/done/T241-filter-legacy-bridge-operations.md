---
id: T241
title: "Filter legacy bridge operations"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-19T10:46:13Z
updated_at: 2026-05-19T10:58:30Z
---

## Requirements

- Expose a `bridgeVersion` field on bridge SDK deposit and withdrawal status records so consumers can distinguish v2-processable operations from legacy operations that are too old for the current sequencer flow.
- Mark testnet deposits with index lower than `68520` and testnet withdrawals with non-provisional index lower than `10529` as legacy bridge-version records.
- Preserve provisional withdrawals with negative indexes as current bridge-version records because they have not been assigned a finalized action index yet.
- Update bridge-ui pending operation hydration so it filters out legacy `bridgeVersion` records before spawning/resuming operation actors.
- Keep the change scoped to SDK status typing/mapping and bridge-ui hydration; do not hardcode legacy index filtering in Vue components.

## Test Plan

- TDD: first add focused tests that fail because SDK status records do not expose `bridgeVersion` and bridge-ui worker mapping does not filter legacy operations.
- RED command target: run the bridge SDK and bridge-ui unit tests that cover the new field and worker filtering.
- GREEN command target: rerun those focused tests after implementation, then run relevant project typechecks if practical.

## RED Evidence

- `moon run bridge-sdk:test -f -- test/utils.test.ts` failed as expected: `bridgeVersionForActionIndex` is not a function for the new bridge-version classifier tests.
- `moon run bridge-ui:test -f -- test/unit/bridge-versions.test.ts` initially failed before collection because Playwright Chromium was missing; `moon run bridge-ui:playwright-install -f` installed the browser prerequisite.
- `moon run bridge-ui:test -f -- test/unit/bridge-versions.test.ts` then failed as expected because `~~/machines/bridgeVersions` does not exist yet.

## GREEN Evidence

- `moon run bridge-sdk:test -f -- test/utils.test.ts` passed; because the SDK Moon task hardcodes `test/*.test.ts`, this ran all non-manual SDK tests: 7 files, 39 tests.
- `moon run bridge-ui:test -f -- test/unit/bridge-versions.test.ts` passed: 1 file, 1 test.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-sdk:lint -f` passed with existing warnings in `src/types.ts` for `ExtractInput<T>` using `any`.
- `moon run bridge-ui:lint -f` passed.
- `moon run bridge-ui:test -f` passed: 14 files, 62 tests.
