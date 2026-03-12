---
id: T087
title: "Bridge CLI SDK adapter and direct commands"
status: done
blockedBy: [T086]
owner: codex
created_at: 2026-03-09T18:54:47Z
updated_at: 2026-03-09T19:28:46Z
---

Implement the SDK adapter, env-key signing flow, and low-level direct commands for the bridge CLI.

Scope:

- wrap `@zeko/bridge-sdk` operations behind a CLI adapter
- implement deposit and withdrawal direct subcommands
- add transaction send, wait, and status helpers
- add redaction and validation coverage for signer/env handling

## RED Evidence

Command: `moon run bridge-cli:test`

Failure summary:

- `tests/signer.test.ts` failed because `../src/core/signer` did not exist
- `tests/sdk-config.test.ts` failed because `../src/core/sdk-config` did not exist
- `tests/direct-commands.test.ts` failed because `../src/commands/direct` did not exist

## GREEN Evidence

Commands:

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`

Pass summary:

- signer secret resolution, SDK config mapping, and direct command handler tests passed
- direct deposit and withdrawal command factories typechecked successfully
- bridge CLI build completed with bundled adapter output
