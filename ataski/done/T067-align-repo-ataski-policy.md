---
id: T067
title: "Align repo Ataski policy"
status: done
blockedBy: [T065]
owner: codex
created_at: 2026-03-11T10:21:57Z
updated_at: 2026-03-11T10:28:33Z
---

## Requirements

- Update the repo-level `AGENTS.md` Ataski section to the vNext policy.
- Add `ataski/config.jsonc` with the upstream default payload.
- Switch repo wording from `config.md` to `config.jsonc`.
- Align terminology to `BDD/TDD/DDD` and `Test Strategy Exception`.
- Make the guidance require `Requirements`, `Test Plan`, `RED Evidence`, and `GREEN Evidence` for new Ataski tasks going forward.

## Test Plan

- Use targeted `rg` checks over tracked repo files to confirm the new terminology and config file references are present.
- Verify the old `config.md` wording is removed from tracked Ataski guidance files.

## RED Evidence

## GREEN Evidence

- Updated the repo-level `AGENTS.md` Ataski workflow block to the vNext contract.
- Added `ataski/config.jsonc` with the upstream default payload.
- Validation:
  - `rg -n "config.jsonc|worktreesDir|BDD/TDD/DDD|Test Strategy Exception" AGENTS.md .agents/skills/ataski ataski/config.jsonc` confirmed the new terminology.
  - `rg -n 'config\.md|TDD Exception' AGENTS.md .agents/skills/ataski` returned no matches.
  - `rg -n 'keep the task.s \`ataski/\` updates in the same worktree|canonical .*main worktree' AGENTS.md .agents/skills/ataski` returned no matches.
