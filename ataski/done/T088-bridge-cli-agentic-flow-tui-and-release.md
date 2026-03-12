---
id: T088
title: "Bridge CLI agentic flow, TUI, and release"
status: done
blockedBy: [T087]
owner: codex
created_at: 2026-03-09T18:54:47Z
updated_at: 2026-03-09T21:53:20Z
---

Implement the end-to-end agent bridge flow, persisted sessions, OpenTUI shell, and public release plumbing.

Scope:

- implement the high-level `bridge` command and resumable operations
- add structured logs and persisted session recovery
- add a minimal OpenTUI session/status viewer
- wire npm release, GitHub release, and public mirror workflows

## RED Evidence

Command: `moon run bridge-cli:test`

Failure summary:

- `tests/session-store.test.ts` failed because `../src/core/session-store` did not exist
- `tests/bridge-flow.test.ts` failed because `../src/commands/bridge` did not exist

## GREEN Evidence

Commands:

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`
- `moon run bridge-cli:lint`

Pass summary:

- persisted session store, streamed bridge flow, reporter helpers, and operation resume all validated
- minimal OpenTUI session viewer added with a Bun-only runtime gate and snapshot coverage
- release workflows, public mirror sync, and package docs landed alongside passing package checks
