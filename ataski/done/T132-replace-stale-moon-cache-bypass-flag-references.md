---
id: T132
title: "Replace stale moon cache-bypass flag references"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T01:30:00Z
updated_at: 2026-03-24T01:33:21Z
---

## Requirements

- Replace repo references that still tell agents or CI to use Moon's old cache-bypass flag spelling.
- Use `-f` instead anywhere the repo means "force rerun / bypass cache".
- Update active workflow and instruction files first, then clean up historical Ataski notes that still show the old Moon cache-bypass examples so repo-wide searches no longer teach the stale flag.
- Do not rewrite unrelated `-u` strings that are not Moon flag references.

## Test Plan

- DDD. First inventory all `moon` + `-u` references with ripgrep. Then patch the relevant files, rerun ripgrep to confirm no stale Moon `-u` examples remain, and run the targeted workflow package test affected by the change.

## RED Evidence

- repo-wide ripgrep audit for stale Moon cache-bypass references
- found stale active references in `AGENTS.md`, `docs/CODEBASE_MAP.md`, and `.github/workflows/use-zeko-skill.yaml`, plus historical Ataski task examples that still showed the old Moon cache-bypass flag

## GREEN Evidence

- reran the same `rg` search after patching and got no matches
- `moon run use-zeko:test -f`
- `moon run use-zeko:check -f`
