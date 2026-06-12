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
