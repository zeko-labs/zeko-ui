---
id: T239
title: "Validate Gemini and Copilot findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-19T10:47:42Z
updated_at: 2026-05-19T10:53:24Z
---

## Requirements

- Read the latest Gemini and Copilot review findings on PR #159.
- Validate each finding against the current `branch/web-404-cancellation-queue` code.
- Fix only findings that are real in the current branch state.
- Keep the PR focused on bridge UI cancellation behavior and Ataski bookkeeping.
- Validate any fixes with bridge UI tests and typecheck before committing and pushing.

## Test Plan

- DDD
- Use review-comment reproduction against current code to decide whether each finding is real.
- For any real finding, add or update focused tests where useful, then run `moon run bridge-ui:test -f` and `moon run bridge-ui:typecheck -f`.

## RED Evidence

- Copilot reviewed commit `fa1003d` and generated no inline comments.
- Gemini finding `discussion_r3242492978` was real: `formatQueueMetadata` hardcoded `en-US` as the default `Intl.DateTimeFormat` locale instead of using the browser locale.
- Gemini finding `discussion_r3242492983` was real: the PAUSED-state `SyncRecoveredState` handler duplicated the root-level handler exactly.
- First focused test attempt failed before collecting tests because Chromium could not spawn with `Unknown system error -88`; retrying after formatting/typecheck succeeded.

## GREEN Evidence

- Changed queue metadata date formatting to default to `navigator.language`, while keeping explicit `options.locale` for deterministic tests and callers.
- Added a regression test that stubs `navigator.language` to `fr-FR` and verifies localized queue metadata.
- Removed the duplicate PAUSED-state `SyncRecoveredState` handler; the root-level handler now covers PAUSED.
- `moon run bridge-ui:format-fix -f`
- `moon run bridge-ui:test -f -- test/unit/helpers-queue.test.ts test/unit/bridge-operation.test.ts` passed: 2 files, 29 tests.
- `moon run bridge-ui:lint -f`
- `moon run bridge-ui:typecheck -f`
- `moon run bridge-ui:test -f` passed: 16 files, 93 tests.
