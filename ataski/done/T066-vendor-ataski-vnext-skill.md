---
id: T066
title: "Vendor Ataski vNext skill"
status: done
blockedBy: [T065]
owner: codex
created_at: 2026-03-11T10:21:57Z
updated_at: 2026-03-11T10:27:10Z
---

## Requirements

- Replace the vendored Ataski skill files with the upstream `Hebilicious/ataski` contents from commit `310deb6645c3aacefe507aa885daabd73bec481c`.
- Update `.agents/skills/ataski/SKILL.md` and `.agents/skills/ataski/references/AGENTS.md`.
- Add `.agents/skills/ataski/references/config.jsonc`.
- Keep the live `ataski/worktree/` bridge-cli canonical worktree out of scope.

## Test Plan

- Diff the vendored files against the upstream raw files for commit `310deb6645c3aacefe507aa885daabd73bec481c`.
- Verify the new vendored content mentions `config.jsonc`, `worktreesDir`, `BDD/TDD/DDD`, and `Test Strategy Exception`.

## RED Evidence

## GREEN Evidence

- Replaced the vendored Ataski skill files from upstream commit `310deb6645c3aacefe507aa885daabd73bec481c`.
- Validation:
  - `diff -u .agents/skills/ataski/SKILL.md <upstream SKILL.md>` returned no diff.
  - `diff -u .agents/skills/ataski/references/AGENTS.md <upstream AGENTS.md>` returned no diff.
  - `diff -u .agents/skills/ataski/references/config.jsonc <upstream config.jsonc>` returned no diff.
  - `rg -n "config.jsonc|worktreesDir|BDD/TDD/DDD|Test Strategy Exception" .agents/skills/ataski` confirmed the expected vNext terminology.
