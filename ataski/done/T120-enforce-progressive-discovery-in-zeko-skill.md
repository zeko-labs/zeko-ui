---
id: T120
title: "Enforce progressive discovery in Zeko skill"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T17:30:52Z
updated_at: 2026-03-11T17:32:30Z
---

## Requirements

- Update the shipped `zeko` skill so it follows progressive discovery instead of pushing agents toward `llms-full.txt` from the start.
- Remove `llms-full.txt` as a root-level default or primary entrypoint.
- Keep discoverable, precise routing in the root `zeko/SKILL.md`, and only mention `llms-full.txt` deeper in the navigation reference as an optional fallback when a targeted page is not enough.
- Preserve the rest of the docs-first structure and keep the skill concise.
- Update tests so this does not regress.

## Test Plan

- `BDD`: add failing tests that reject `llms-full.txt` in the root skill and require any remaining mention of it to be framed as fallback rather than the first step.
- RED path before implementation: make `moon run use-zeko:test` fail against the current root copy, then update the skill content until `moon run use-zeko:test` and `moon run use-zeko:check` pass again.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected because the root `zeko/SKILL.md` still told agents to start with `https://docs.zeko.io/llms-full.txt`, and `references/10-navigation.md` still presented that file as the fastest index instead of a fallback behind the more precise routed references.

## GREEN Evidence

- `moon run use-zeko:test`
- Passed after removing `llms-full.txt` from the root skill and constraining it to fallback-only wording in the navigation reference.
- `moon run use-zeko:check`
- Passed end to end with the new progressive-discovery wording, link validation, endpoint checks, and prompt evals intact.
