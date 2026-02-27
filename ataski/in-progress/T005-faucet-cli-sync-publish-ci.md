---
id: T005
title: "Faucet CLI sync publish CI"
status: in-progress
blockedBy: [T004]
owner: codex
created_at: 2026-02-27T07:09:31Z
updated_at: 2026-02-27T07:44:09Z
---

Add the monorepo split sync workflow and mirrored npm publish workflow for the
faucet CLI package.

## Validation Plan

This task is CI and packaging configuration only. Validation will use workflow
syntax inspection plus package build assumptions already proven by T004.
