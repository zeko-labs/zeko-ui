---
id: T459
title: "validate-bridge-pending-transactions-release"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-06T00:00:00Z
updated_at: 2026-07-06T00:00:00Z
---

## Requirements

- Complete task 05 from `.planning/features/003-bridge-ui-local-pending-transactions/tasks/05-add-tests-and-release-metadata.md`.
- Confirm automated tests cover pending-only rows, duplicate pending/fetched rows, wallet/network scoping, and `Awaiting inclusion` labeling.
- Run relevant `bridge-ui` validation commands through Moon.
- Handle release/versioning metadata for `@zeko/bridge-ui` according to `.changeset/config.json` and app package metadata.
- Do not weaken tests or add unrelated refactors.

## Test Plan

- BDD.
- Verify the implemented behavior through existing and newly added focused tests, then run the broadest practical bridge-ui test command available in this harness.
- Record any environment blockers with exact command output.

## RED Evidence

## GREEN Evidence

- `./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false test/unit/bridge-operations-table.test.ts test/unit/pending-transactions.test.ts` passed: 13 tests.
- `./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `./node_modules/.bin/moon run bridge-ui:test -f -- --browser.enabled=false` failed because existing tests require browser globals in the Node-only environment; focused feature tests pass.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed after removing Node built-in imports from Nuxt config files.
- No changeset/package version bump: `@zeko/bridge-ui` is private, ignored by Changesets, and has no version field.
