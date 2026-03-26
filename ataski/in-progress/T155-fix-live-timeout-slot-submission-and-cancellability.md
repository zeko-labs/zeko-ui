---
id: T155
title: "Fix live timeout-slot submission and cancellability"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-03-25T11:20:00Z
updated_at: 2026-03-25T11:42:00Z
---

## Requirements

- Investigate why deposits submitted with `timeoutSlots=1` are surfacing later with long future timeout values and never becoming cancellable in live SDK/CLI status.
- Verify the end-to-end deposit submit path across bridge-cli and bridge-sdk instead of patching only status formatting.
- Fix the actual timeout propagation bug so newly submitted short-timeout deposits retain the intended timeout and become cancellable when timed out.
- Keep the existing public CLI and SDK APIs stable.

## Test Plan

- TDD
- Add or extend targeted bridge-cli and bridge-sdk tests around deposit submit timeout propagation before changing the implementation, then re-run the relevant moon test/typecheck/build tasks and perform a live CLI verification.

## RED Evidence

- Live unresolved deposits for `B62qkJ3BRNyrrxoW1zTJTDXf6UCpSxSaCcam3wMDXRqgzReY8GwQQdq` currently show future timeout slots far beyond `currentSlot`, despite the intended `timeoutSlots=1` submission flow.
- The SDK/CLI therefore continue to report `cancellable: false` for deposits that the user expected to have timed out already.

## GREEN Evidence

- Added parser-level bridge-cli coverage in `packages/bridge-cli/tests/direct-commands.test.ts` and `packages/bridge-cli/tests/bridge-command.test.ts` proving `--timeout-slots 1` reaches the adapter as `timeoutSlots: 1` for both direct deposit submits and the high-level `bridge` command.
- Fixed command parsing in `packages/bridge-cli/src/commands/direct.ts` and `packages/bridge-cli/src/commands/bridge.ts` by accepting the kebab-case flag explicitly and aliasing it at the command definition.
- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:build`
- Live submit after the parser fix succeeded with hash `5Jttuaz4a5kjTkGnQo2W34MPL96gBJCJgDTeYpJ2LtnZ8G8mRms2`, but it is still `PENDING` at the Mina node and has not indexed into `deposit status` yet, so the on-chain timeout value remains unverified in status output.
