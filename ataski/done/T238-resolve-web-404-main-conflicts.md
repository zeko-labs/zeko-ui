---
id: T238
title: "Resolve WEB-404 main conflicts"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-14T15:14:24Z
updated_at: 2026-05-14T15:30:00Z
---

## Requirements

- Merge the latest `origin/main` into `branch/web-404-cancellation-queue`.
- Resolve conflicts while preserving the WEB-404 cancellation queue UX and the simplified parent-machine queue state.
- Keep WEB-404 Ataski task records after the latest main tasks instead of colliding with main task IDs.
- Validate with bridge UI typecheck and tests.
- Commit and push the branch for review.

## Test Plan

- DDD
- Use the merge result plus existing bridge UI queue, recovery, and operation tests as the validation gate.
- Run `moon run bridge-ui:typecheck -f` and `moon run bridge-ui:test -f`.

## RED Evidence

- `git merge origin/main` stopped on `ataski/tasks.md` because both main and WEB-404 had allocated T195+ task IDs.
- `moon run bridge-ui:test -f` initially failed before running tests because Playwright Chromium was not installed locally.
- `moon run bridge-sdk:manual-live-test -f` timed out after 30 seconds against public live endpoints.
- Direct live bridge status read for `B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF` timed out after 60 seconds.
- Local browser manual check reached the bridge UI, but the in-app browser has no Auro wallet extension and macOS Computer Use permissions are not granted for Edge, so real-wallet rendered-queue validation is blocked.

## GREEN Evidence

- Merged latest `origin/main` into `branch/web-404-cancellation-queue`.
- Resolved the Ataski conflict by preserving main's T195-T210 tasks and moving WEB-404 tasks to T211-T238.
- Verified no duplicate Ataski task IDs and no remaining merge conflict markers.
- Removed the unused `anotherCancellationIsActive` guard from `apps/bridge-ui/machines/bridgeOperation.ts`.
- Confirmed the PR-specific diff against `origin/main` is scoped to `apps/bridge-ui/**` and Ataski files; SDK/CLI changes are only present as merged main payload.
- `moon run bridge-ui:format-fix -f`
- `moon run bridge-ui:lint -f`
- `moon run bridge-ui:typecheck -f`
- `moon run bridge-ui:test -f` passed: 16 files, 92 tests.
- `moon run bridge-ui:dev` served the app at `http://localhost:3090/`; local no-wallet render was verified in the in-app browser.
