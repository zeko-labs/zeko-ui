---
id: T086
title: "Bridge CLI canonical scaffold"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-09T18:54:47Z
updated_at: 2026-03-09T19:05:32Z
---

Create the public `@zeko-labs/bridge-cli` package scaffold on top of the canonical `canonical/bridge-cli` integration branch.

Scope:

- add the package layout under `packages/bridge-cli`
- add moon tasks, package metadata, and initial docs
- define route/config, session/log storage, and command skeleton
- add the initial test harness and RED/GREEN evidence for scaffolded behavior

## RED Evidence

Command: `moon run bridge-cli:test`

Failure summary:

- `tests/routes.test.ts` failed because `../src/core/routes` did not exist
- `tests/paths.test.ts` failed because `../src/core/paths` did not exist
- `tests/cli.test.ts` failed because `../src/cli` did not exist

## GREEN Evidence

Commands:

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`

Pass summary:

- route registry, XDG path resolution, and top-level CLI skeleton tests passed
- package typecheck passed
- package build produced `dist/cli.js` and `dist/index.js`
