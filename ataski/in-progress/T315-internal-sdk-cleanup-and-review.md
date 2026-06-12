---
id: T315
title: "internal-sdk-cleanup-and-review"
status: in-progress
blockedBy: []
owner: codex
created_at: 2026-06-12T12:29:27Z
updated_at: 2026-06-12T12:29:27Z
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
