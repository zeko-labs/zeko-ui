---
id: T240
title: "Fix PR 159 CI and validate queue review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-19T11:17:23Z
updated_at: 2026-05-19T11:24:55Z
---

## Requirements

- Fix the PR 159 `bridge-ui:test-ci` failure where `formatQueueMetadata` throws on a browser locale such as `en-US@posix`.
- Preserve localized submitted-time formatting for valid browser locales and explicit test locale options.
- Validate the review finding that operation queue components rendered by `v-for` can reuse actor-backed children without stable keys.
- Apply a queue rendering fix only if the finding is real; otherwise record why no code change is needed.
- Keep the implementation limited to bridge UI helpers/tests/components needed for this review follow-up.

## Test Plan

- TDD for the locale utility: first add a focused failing unit test that exercises an invalid browser locale and expects metadata formatting to fall back instead of throwing.
- BDD-style structural validation for the queue rendering finding: inspect Vue component identity behavior and the existing `useSelector` subscription model, then add stable queue keys if the finding is real.
- GREEN validation will run the focused helper test, `moon run bridge-ui:test -f`, and `moon run bridge-ui:typecheck -f` when local dependencies allow it.

## RED Evidence

- GitHub CI on PR 159 latest commit `09956a39665c38ca631b0aee125dbfa6fca970a4` failed `RunTask(bridge-ui:test-ci)` with `RangeError: Invalid language tag: en-US@posix` in `app/helpers.ts:123`.
- Added focused regression coverage for `navigator.language === "en-US@posix"` and ran `moon run bridge-ui:test -f -- test/unit/helpers-queue.test.ts`; it failed as expected with `expected [Function] to not throw an error but 'RangeError: Invalid language tag: en-US@posix' was thrown`.

## GREEN Evidence

- Fixed `formatQueueMetadata` to pass only supported browser locale tags into `Intl.DateTimeFormat`, falling back to the runtime default when a browser reports a nonstandard locale such as `en-US@posix`.
- Validated the queue rendering finding as real: `Bridge.vue` rendered operation actor components in unkeyed `v-for` loops, while `CancellableOperation.vue` and `QueuedOperation.vue` subscribe to the actor passed during setup through `useSelector`; reused component instances could therefore retain stale actor subscriptions after queue reorder/removal. Added `:key="operation.id"` to all operation queue loops.
- `moon run bridge-ui:test -f -- test/unit/helpers-queue.test.ts` passed: 13 tests.
- `moon run bridge-ui:test -f` passed: 16 files, 94 tests.
- `moon run bridge-ui:test-ci -f` passed: 16 files, 94 tests.
- `moon run bridge-ui:typecheck -f` passed.
- `moon run bridge-ui:lint -f` passed.
- `moon run bridge-ui:format -f` passed.
