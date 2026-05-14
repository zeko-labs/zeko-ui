---
id: T206
title: "resolve final main conflicts"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-05-14T06:38:02Z
updated_at: 2026-05-14T06:38:02Z
---

## Requirements

- Merge the current `origin/main` into `branch/t165-bridge-cli-sdk-resume-fix`.
- Resolve conflicts while preserving this PR's standalone bridge SDK/CLI bugfix scope.
- Keep the bridge CLI cleanup refactor behavior unchanged except where required to integrate main.
- Rebuild and validate the bridge CLI and SDK before pushing the branch for final review.
- Leave unrelated local files such as the untracked `zeko:testnet` untouched.

## Test Plan

- BDD: use the existing bridge CLI and SDK test suites as regression coverage for the merge result.
- RED path: record merge conflicts and any failing validation caused by the main merge.
- GREEN path: run `moon run bridge-cli:test -f`, `moon run bridge-cli:typecheck -f`, `moon run bridge-cli:build -f`, `moon run bridge-sdk:test -f`, `moon run bridge-sdk:typecheck -f`, and `git diff --check`.

## RED Evidence

Pending.

## GREEN Evidence

Pending.
