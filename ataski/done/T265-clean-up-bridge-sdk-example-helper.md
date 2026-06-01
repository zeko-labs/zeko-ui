---
id: T265
title: "clean-up-bridge-sdk-example-helper"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-25T09:33:06Z
updated_at: 2026-05-25T09:40:00Z
---

## Requirements

- Refactor `packages/bridge-sdk/examples/helper.ts` so the bridge example environment parsing is compact and readable.
- Preserve the current public helper exports and behavior:
  - `readEnv(key, fallback)` trims values and falls back for missing/empty values.
  - `readBridgeConfig()` reads `L1_NETWORK`, `L2_NETWORK`, endpoint overrides, and returns a `Config`.
  - `readMinaPrivateKey()` requires `MINA_PRIVATE_KEY`.
  - `writeLog()` writes JSON logs under `tmp/`.
- Keep mainnet and testnet default endpoints unchanged.
- Avoid broad rewrites outside this helper unless validation shows they are required.

## Test Plan

- TDD is not useful for this cleanup because it should preserve behavior without introducing new logic, and the helper has no existing dedicated test harness.
- Test Strategy Exception: before editing, validate the current helper compiles through the bridge SDK typecheck. After editing, rerun the same typecheck and a focused format check to prove the refactor preserves the exported API and type contract.

## RED Evidence

- Baseline validation before source edits: `moon run bridge-sdk:typecheck -f` passes.

## GREEN Evidence

- `moon run bridge-sdk:typecheck -f` passes after the helper refactor.
- `git diff --check` passes.
- `pnpm exec biome format --write packages/bridge-sdk/examples/helper.ts` did not process the file because Biome ignores `packages/bridge-sdk/examples`; no formatter changes were applied.
