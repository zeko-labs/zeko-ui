---
id: T251
title: "Split SDK CLI validator prerequisites"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-25T21:20:37Z
updated_at: 2026-05-25T21:20:37Z
---

## Requirements

- Extract the bridge SDK and bridge CLI fixes required by the validator into a standalone branch based on `origin/main`.
- Keep validator service files out of this branch so the validator PR can target this branch and review only service code.
- Preserve the fixes proven during validator investigation: published CLI bin execution, signer/account mismatch protection, SDK V2 deposit filtering, recoverable gateway mutation retry, and precise accepted-but-unconfirmed deposit wait reasons.
- Add one changeset for the SDK/CLI package changes.

## Test Plan

- TDD/regression. Keep the existing regression coverage for each extracted behavior and adapt it to the current `origin/main` SDK structure.
- Run bridge SDK and bridge CLI tests plus typecheck/lint/build gates before opening the extracted PR.

## RED Evidence

- PR #150 currently mixes bridge-validator service files with bridge SDK/CLI fixes, making validator review depend on unrelated package changes.

## GREEN Evidence

- The extracted branch contains only SDK/CLI/package/Ataski files, plus one changeset.
