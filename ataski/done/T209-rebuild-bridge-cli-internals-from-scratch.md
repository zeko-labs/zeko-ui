---
id: T209
title: "rebuild-bridge-cli-internals-from-scratch"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T02:58:31Z
updated_at: 2026-05-13T03:13:20Z
---

## Requirements

- Delete the existing bridge-cli internal implementation shape and rebuild the internals from scratch with the most direct implementation that preserves end-user behavior.
- Keep the CLI executable entrypoint and public command behavior stable: flags, JSON output, persisted session fields, retry behavior, direct commands, operation commands, TUI command, doctor command, package boundary, and built package entrypoint.
- Do not modify `packages/bridge-sdk`.
- Prefer SDK calls and simple CLI-owned persistence/output helpers over adapter/service/runtime layers.
- Remove tests that only lock old internal module structure; keep or rewrite tests that validate public behavior and important persisted/output contracts.

## Test Plan

- DDD: use the existing public command tests and bridge flow tests as the behavior contract while replacing implementation internals.
- Run `moon run bridge-cli:typecheck -f`, `moon run bridge-cli:test -f`, `moon run bridge-cli:lint -f`, and `moon run bridge-cli:build -f`.
- Confirm `packages/bridge-sdk` has no diff before commit.

## RED Evidence

- User review on 2026-05-13 clarified that the intended scope is to delete all bridge-cli internals and rewrite them from scratch, not incrementally clean the PR.

## GREEN Evidence

- Deleted the old `packages/bridge-cli/src/commands/**` and `packages/bridge-cli/src/core/**` implementation trees.
- Rebuilt the CLI internals into `packages/bridge-cli/src/app.ts`, leaving `packages/bridge-cli/src/cli.ts` as the executable entrypoint.
- Repointed behavior tests at the new internal module and removed tests that only locked the deleted internal module structure.
- Preserved command behavior covered by bridge, direct, TUI, doctor, CLI skeleton, and package-boundary tests.
- Confirmed `packages/bridge-sdk` has no diff.
- Validation passed:
  - `moon run bridge-cli:typecheck -f`
  - `moon run bridge-cli:test -f`
  - `moon run bridge-cli:lint -f`
  - `moon run bridge-cli:build -f`
