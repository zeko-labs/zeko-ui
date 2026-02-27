---
id: T005
title: "Faucet CLI sync publish CI"
status: in-progress
blockedBy: [T004]
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:52:00Z
---

Add the monorepo split sync workflow and mirrored npm publish workflow for the
faucet CLI package.

## Validation Plan

This task is CI and packaging configuration only. Validation will use workflow
syntax inspection plus package build assumptions already proven by T004.

## TDD Exception

This follow-up adjusts package-manager metadata only. A failing test is not
applicable because the blocker is `npm install` rejecting `catalog:` specifiers
in the split repo. Validation will use an `npm install` dry run in
`packages/faucet-cli` before and after the manifest fix.

## GREEN Evidence

- `npm install --package-lock-only --ignore-scripts --dry-run` in
  `packages/faucet-cli` passed (`up to date in 10s`).
