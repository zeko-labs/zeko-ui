---
id: T136
title: "Add use-zeko validation, evals, and CI"
status: done
blockedBy: [T134]
owner: codex
created_at: 2026-03-11T15:23:20Z
updated_at: 2026-03-11T15:42:30Z
---

## Requirements

- Add deterministic validation and eval tooling for the public skill inside this monorepo.
- Cover structural checks, external link checks, source-of-truth file mapping checks, endpoint-value checks against canonical files, and prompt-based evals that exercise the skill itself.
- Wire the tooling into repo workflows using Moon tasks and GitHub Actions on pull requests plus a weekly cron.
- Ensure the anti-staleness approach prefers live validation against upstream/canonical sources and active evals over hand-maintained copied prose.

## Test Plan

- `BDD`: define behavior through failing tests for structural validation, source-map validation, and endpoint assertions; then add command-level green evidence from the Moon task and CI-entry workflow commands.
- RED path before implementation: create tests that fail until the validation scripts, fixtures, and Moon wiring exist.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected because the package does not yet ship `src/cli.ts`, `src/index.ts`, `src/spec.ts`, the `validate` or `eval` Moon tasks, or a dedicated scheduled workflow file.

## GREEN Evidence

- `moon run use-zeko:check`
- Passed after compiling the validator CLI, running the Vitest suite, checking canonical source mappings, checking endpoint strings against source files, probing the live external links that are expected to be public today, and running the prompt-based routing eval cases.
