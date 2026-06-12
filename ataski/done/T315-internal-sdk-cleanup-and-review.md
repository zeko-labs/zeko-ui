---
id: T315
title: "internal-sdk-cleanup-and-review"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T12:29:27Z
updated_at: 2026-06-12T17:46:59Z
---

## Requirements

- Keep `@zeko/sdk` and `@zeko/networks` as internal workspace packages for now: remove public publish posture, remove the new changeset, and keep package entrypoints usable by bridge UI, bridge CLI, and bridge validator through workspace dependencies.
- Split `packages/sdk/src/index.ts` into focused modules instead of one large wallet implementation file.
- Investigate the current repository typecheck tooling and explain whether `tsgo` should replace `tsc` in the new package Moon tasks now.
- Run Codex review on PR #208 after the cleanup, verify any findings, and fix actionable issues.

## Test Plan

- TDD: use existing SDK/network boundary tests as regression tests while refactoring module layout and package metadata.
- RED evidence is the current implementation state: `@zeko/sdk` is a single large `src/index.ts`, `@zeko/sdk` and `@zeko/networks` include public publish metadata and a changeset, and the new package Moon tasks use `tsc --noEmit`.
- GREEN requires `sdk:test`, `sdk:typecheck`, `networks:test`, `bridge-ui:test`, `bridge-ui:typecheck`, `bridge-cli:typecheck`, `bridge-validator:typecheck`, and Codex review to pass or have verified non-actionable findings.

## RED Evidence

- Current code has `packages/sdk/src/index.ts` containing the wallet machine, Auro constants, balance fetch logic, and exported types in one file.
- Current package metadata marks `@zeko/sdk` and `@zeko/networks` as public publishable packages with `version`, `publishConfig`, and `files`.
- Current branch includes `.changeset/auro-wallet-sdk.md`, which is not desired while the packages remain internal.
- Current `packages/sdk/moon.yml` and `packages/networks/moon.yml` use `tsc --noEmit`.

## GREEN Evidence

- Removed `.changeset/auro-wallet-sdk.md`; `@zeko/sdk` and `@zeko/networks` are now private workspace packages that export `./src/index.ts` directly instead of public `dist` artifacts.
- Split `packages/sdk/src/index.ts` into focused `balance`, `events`, `logger`, `networks`, `provider`, and `wallet` modules while preserving the `@zeko/sdk` public barrel exports.
- `pnpm exec tsgo --version` fails with `Command "tsgo" not found`, so the package tasks stay on the repository-standard `tsc --noEmit` path until the native TypeScript toolchain is added at the workspace level.
- Validation passed:
  - `pnpm exec moon run networks:test -f`
  - `pnpm exec moon run networks:typecheck -f`
  - `pnpm exec moon run sdk:test -f`
  - `pnpm exec moon run sdk:typecheck -f`
  - `pnpm exec moon run bridge-ui:test -f`
  - `pnpm exec moon run bridge-ui:typecheck -f`
  - `pnpm exec moon run bridge-cli:typecheck -f`
  - `pnpm exec moon run bridge-validator:typecheck -f`

## Blocked Evidence

- `codex-review` was run for PR #208 with `.agents/skills/codex-review/scripts/codex-review --mode branch`, but it exited before producing findings because the Codex usage limit was reached. The tool reported retry availability at 8:49 PM local time.

## Review Evidence

- Reran `.agents/skills/codex-review/scripts/codex-review --mode branch`; accepted two actionable findings:
  - `@zeko-labs/bridge-cli` could not publish while `@zeko/networks` appeared as a private workspace package dependency.
  - CLI route polling still classified Zeko networks with `startsWith("zeko:")`, which missed the new `zeko-m:*` nomenclature.
- Fixed by keeping `@zeko/networks` as the single source of truth, adding a typed `isZekoBridgeCliNetwork` dictionary predicate there, and bundling the package into the CLI through build/test aliases rather than exposing it in `packages/bridge-cli/package.json`.
- Follow-up validation passed:
  - `pnpm exec moon run networks:test -f`
  - `pnpm exec moon run networks:typecheck -f`
  - `pnpm exec moon run bridge-cli:typecheck -f`
  - `pnpm exec moon run bridge-cli:test -f`
  - `pnpm exec moon run bridge-cli:build -f`
  - `pnpm exec moon run bridge-ui:typecheck -f`
  - `pnpm exec moon run bridge-ui:test -f`
  - `git diff --check`
  - `pnpm --dir packages/bridge-cli pack --pack-destination "$pack_dir" --json`
- Packed `@zeko-labs/bridge-cli@0.2.3` contains no `@zeko/networks` dependency in `package/package.json`, and `package/dist/cli.js` includes the bundled `BRIDGE_CLI_NETWORK_KINDS`, `zeko-m:testnet`, and `{ custom: "zeko-mainnet" }` markers.
- Reran `.agents/skills/codex-review/scripts/codex-review --mode branch`; accepted two additional backwards-compatibility findings:
  - Existing faucet clients may still send the legacy `zeko-testnet` chain ID.
  - Existing bridge CLI operation sessions may persist legacy route strings such as `mina:testnet->zeko:testnet` or `zeko:zeko-mainnet->mina:mainnet`.
- Fixed by adding a finite `LEGACY_NETWORK_ALIASES` dictionary in `@zeko/networks`, normalizing faucet input before validation while returning/storing `zeko-m:testnet`, and normalizing persisted CLI route strings before route validation.
- Follow-up compatibility validation passed:
  - `pnpm exec moon run networks:test -f`
  - `pnpm exec moon run networks:typecheck -f`
  - `pnpm exec moon run bridge-cli:test -f`
  - `pnpm exec moon run bridge-cli:typecheck -f`
  - `pnpm exec moon run bridge-cli:build -f`
  - `pnpm exec moon run faucet:test -f`
  - `pnpm exec moon run faucet:typecheck -f`
  - `git diff --check origin/main`
  - `git diff --check`
  - `pnpm --dir packages/bridge-cli pack --pack-destination "$pack_dir" --json`
- Repacked `@zeko-labs/bridge-cli@0.2.3` still contains no `@zeko/networks` dependency in `package/package.json`, and the bundled CLI contains the legacy alias table for `zeko-testnet` and `zeko:zeko-mainnet`.
- Reran `.agents/skills/codex-review/scripts/codex-review --mode branch`; accepted two additional persisted-state compatibility findings:
  - Existing faucet KV address claim keys are stored under legacy chain IDs such as `claim:zeko-testnet:<address>`, so checking only the canonical `claim:zeko-m:testnet:<address>` key would allow duplicate claims.
  - CLI `operation resume-all` matched persisted sessions with raw `session.route === formatRoute(from, to)`, so legacy routes such as `mina:testnet->zeko:testnet` would not attach to existing operations.
- Fixed by deriving legacy faucet address-claim keys from `LEGACY_NETWORK_ALIASES` and by canonicalizing persisted session routes before pending-operation matching.
- Follow-up persisted-state compatibility validation passed:
  - `pnpm exec moon run bridge-cli:test -f`
  - `pnpm exec moon run faucet:test -f`
  - `pnpm exec moon run bridge-cli:typecheck -f`
  - `pnpm exec moon run faucet:typecheck -f`
  - `pnpm exec moon run bridge-cli:build -f`
  - `git diff --check`
  - `git diff --check origin/main`
  - `pnpm --dir packages/bridge-cli pack --pack-destination "$pack_dir"`
- Repacked `@zeko-labs/bridge-cli@0.2.3` still contains no `@zeko/networks` dependency in `package/package.json`, and the bundled CLI still contains the `BRIDGE_CLI_NETWORK_KINDS`, `LEGACY_NETWORK_ALIASES`, `zeko-m:mainnet`, and `zeko-mainnet` markers.
- Reran `.agents/skills/codex-review/scripts/codex-review --mode branch`; accepted two additional findings:
  - Direct CLI chain flags still rejected legacy aliases such as `--to zeko:testnet`.
  - The public bridge CLI mirror would still sync source files, making standalone source builds rely on private workspace package source.
- Fixed by normalizing direct CLI chain flag aliases before route validation and by changing the bridge CLI mirror workflow to build first, then sync the built `dist` artifact instead of source.
- Final validation passed:
  - `pnpm exec moon run bridge-cli:test -f`
  - `pnpm exec moon run sync-standalone-package:test -f`
  - `pnpm exec moon run bridge-cli:build -f`
  - `git diff --check`
  - `pnpm --dir packages/bridge-cli pack --pack-destination "$pack_dir"`
  - `.agents/skills/codex-review/scripts/codex-review --mode branch`
- Final `codex-review` completed clean with no accepted/actionable findings. The packed `@zeko-labs/bridge-cli@0.2.3` package still has no `@zeko/networks` dependency or runtime import, and `package/dist/cli.js` contains the canonical network data, legacy aliases, and `{ custom: "zeko-mainnet" }` marker.
