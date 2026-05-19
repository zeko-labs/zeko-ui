---
id: T203
title: "Expose bridge CLI poll delay flags"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-12T22:08:41Z
updated_at: 2026-05-12T22:13:04Z
---

## Requirements

- Add real CLI flags for controlling bridge operation polling delay and retry delay instead of requiring tests or live validation to call internal Node entrypoints.
- Apply the flags to the high-level `bridge` command and `operation resume`, because both run the persisted bridge operation loop.
- Keep the flags optional and preserve current defaults when they are omitted.
- Validate through the built CLI help and automated tests that the flags are accepted and passed to the operation runtime.

## Test Plan

- TDD: first confirm the built CLI does not expose poll-delay flags, then add focused command tests for `bridge` and `operation resume` parsing before implementation.

## RED Evidence

- `packages/bridge-cli/dist/cli.js bridge --help` and `packages/bridge-cli/dist/cli.js operation resume --help` expose no poll/retry delay options, so live validation cannot request 3-minute polling through the public CLI.

## GREEN Evidence

- `moon run bridge-cli:test -f -- tests/cli.test.ts`: passed, including command-entry tests that verify `--poll-interval-ms` controls runtime sleep for `bridge` and `operation resume`.
- `moon run bridge-cli:typecheck -f`: passed.
- `moon run bridge-cli:build -f`: passed.
- Built CLI help now exposes `--poll-interval-ms` and `--retry-delay-ms` on `bridge`, `operation resume`, and `operation resume-all`.
- `moon run bridge-cli:test -f`: passed, 75 passed and 13 skipped.
- `git diff --check`: passed.
