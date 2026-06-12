---
id: T319
title: "Fix faucet review network gaps"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T21:15:00Z
updated_at: 2026-06-12T21:23:00Z
---

## Requirements

- Keep the faucet deployment script help text executable by normalizing the advertised Zeko-M network IDs before using Lumina endpoint maps.
- Declare the shared `networks` Moon dependency for faucet UI and faucet worker consumers.
- Keep the review fixes scoped to the Codex review findings.

## Test Plan

- DDD: verify the review findings against the local code, patch the minimal dependency and normalization gaps, then validate the affected faucet script/typecheck paths.
- Rerun Codex review after the fixes.

## RED Evidence

- Codex review reported P2 findings for `apps/faucet/scripts/cli.ts`, `apps/faucet-ui/moon.yml`, and `apps/faucet/moon.yml`.

## GREEN Evidence

- Added `networks` to the Moon dependencies for `apps/faucet-ui` and `apps/faucet`.
- Normalized `zeko-m:testnet` and `zeko-m:mainnet` to the Lumina endpoint keys before `apps/faucet/scripts/cli.ts` indexes `urls` and `archiveUrls`.
- `pnpm --dir apps/faucet exec tsc --noEmit -p test/tsconfig.json` passed.
- `pnpm --dir apps/faucet-ui exec nuxi typecheck` passed.
- `pnpm --dir apps/faucet exec tsc --noEmit --moduleResolution bundler --module esnext --target es2022 --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --experimentalDecorators --emitDecoratorMetadata --strict scripts/cli.ts` passed.
- `git diff --check` passed.
