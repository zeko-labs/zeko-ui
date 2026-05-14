---
id: T228
title: "Consolidate non-cancel bridge sdk and cli fixes into t165"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-30T00:00:00Z
updated_at: 2026-03-30T00:00:00Z
---

## Requirements

- Use `branch/t165-bridge-cli-sdk-resume-fix` as the single branch/worktree/PR for non-cancellation bridge-sdk and bridge-cli fixes.
- Extract from the WEB-404 branch only the SDK/CLI changes that are not directly part of the cancellation UI feature.
- Keep cancellation-specific SDK/CLI changes out of `t165`.
- Update the branch and PR metadata if needed so the resulting PR clearly reflects the consolidated non-cancellation scope.

## Test Plan

- TDD
- Compare `branch/web-404-cancellation-queue` against `branch/t165-bridge-cli-sdk-resume-fix`, move only the missing non-cancellation SDK/CLI changes, then validate the affected bridge-sdk and bridge-cli tasks before pushing.

## RED Evidence

- The current WEB-404 PR contains SDK/CLI bugfixes that belong in the separate `t165` PR.

## GREEN Evidence

- Added the missing non-cancellation SDK/CLI fixes from `branch/web-404-cancellation-queue` into `branch/t165-bridge-cli-sdk-resume-fix`:
  - bridge-cli `--timeout-slots` parsing on high-level and direct deposit commands
  - bridge-cli recoverable direct-submit mutation retries
  - bridge-cli status timestamp normalization
  - bridge-sdk unresolved withdrawal timestamp normalization
- Updated PR `#163` title/body to reflect the consolidated scope: `fix(bridge): consolidate sdk and cli bugfixes`
- Pushed `branch/t165-bridge-cli-sdk-resume-fix` at commit `6f111d2`
- Validation:
  - `moon run bridge-cli:test`
  - `moon run bridge-cli:typecheck`
  - `moon run bridge-sdk:test`
  - `moon run bridge-sdk:typecheck`
