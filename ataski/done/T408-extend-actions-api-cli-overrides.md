---
id: T408
title: "Extend actions API CLI overrides"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-19T14:25:00Z
updated_at: 2026-06-19T15:45:05Z
---

## Requirements

- Add `--actions-api` support to operation recovery commands that create bridge adapters after the initial high-level bridge command: `operation status`, `operation resume`, and `operation resume-all`.
- Add `--actions-api` support to direct withdrawal inspection/finalization commands so local Actions API/indexer validation can use the same source for status and finalization as the high-level `bridge` command.
- Keep the override optional; default behavior must continue to use the route default Actions API.
- Preserve existing poll/retry/json/verbose behavior.

## Test Plan

- TDD: add focused CLI command tests proving `--actions-api` is accepted and passed into adapter creation for operation status/resume/resume-all and withdrawal status/finalize.
- Then wire the command arguments through existing adapter creation paths.

## RED Evidence

- Built CLI help currently shows no `--actions-api` option for `operation status`, `operation resume`, `operation resume-all`, `withdrawal status`, or `withdrawal finalize`.

## GREEN Evidence

- Added shared endpoint override parsing and adapter propagation for `--actions-api` across `bridge`, `operation status`, `operation resume`, `operation resume-all`, and direct `deposit`/`withdrawal` commands.
- `moon run bridge-cli:test -f -- tests/cli.test.ts tests/sdk-config.test.ts tests/direct-commands.test.ts` passed: 3 files, 40 tests.
- `moon run bridge-cli:typecheck -f` passed.
- Live recovery used `operation status` and `operation resume` with `--actions-api http://127.0.0.1:9100/graphql`; both successfully used the local Actions API while resuming operation `c83028f1-deef-4cef-82c6-1eb91e70d7c8`.
