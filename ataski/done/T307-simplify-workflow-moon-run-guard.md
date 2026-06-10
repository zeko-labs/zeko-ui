---
id: T307
title: "Simplify workflow Moon run guard"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T15:45:40Z
updated_at: 2026-06-10T15:49:22Z
---

## Requirements

- Move the workflow Moon command guard out of package runtime `src` and into root `scripts`.
- Replace shell-token parsing with a simpler line-oriented pattern match for literal `moon run <project>:<task>` usages.
- Preserve the CI protection: workflows must not use `moon run` for tasks that are not marked `runInCI`; use `moon exec --ignore-ci-checks` for those tasks instead.

## Test Plan

- BDD: update the existing tests to import the root script and verify the simplified pattern catches a bad `moon run cloudflare-build-config:sync` line while allowing `moon exec --ignore-ci-checks`.
- GREEN evidence will include `cloudflare-build-config` test, typecheck, lint, and format tasks.

## RED Evidence

- PR review identified that the guard lived in package `src` even though it is repo harness code, and that the shell-tokenizing scanner was more complex than needed.

## GREEN Evidence

- Moved the guard to `scripts/check-workflow-moon-run.ts`.
- Simplified the scanner to a line-oriented regex over workflow text: find `moon run`, extract literal `<project>:<task>`, and compare the target against Moon task `runInCI` metadata.
- `moon run cloudflare-build-config:test -f`: passed 12 Vitest tests.
- `moon run cloudflare-build-config:typecheck -f`: passed.
- `moon run cloudflare-build-config:lint -f`: passed, including `../../scripts/check-workflow-moon-run.ts`.
- `moon run cloudflare-build-config:format -f`: passed.
- `node scripts/check-workflow-moon-run.ts`: passed against current checked-in workflows.
