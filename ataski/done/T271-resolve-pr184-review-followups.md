---
id: T271
title: "Resolve PR184 review followups"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-26T02:00:29Z
updated_at: 2026-05-26T02:04:18Z
---

## Requirements

- Remove the incorrect T251 split task artifact from the PR diff.
- Update the PR title, PR description, and changeset to describe the actual bridge CLI and SDK behavior changes, not their relationship to unrelated downstream work.
- Remove the bridge CLI entrypoint conditional and its helper; the package is a CLI package and invoking/importing the entrypoint should not need a bin-name heuristic.
- Remove local-machine-specific and redundant guidance from `packages/bridge-cli/AGENTS.md`.
- Make bridge CLI dotenv loading explicitly preserve inherited shell variables over every dotenv file location.
- Update bridge CLI docs and tests so env precedence is clear: an inline/exported env value wins, then the first readable dotenv file wins for otherwise unset keys.

## Test Plan

- TDD: first add/update focused tests for the env loader and CLI skeleton so the intended env precedence and unconditional CLI entrypoint shape are captured.
- Use existing Moon package gates for GREEN validation: `bridge-cli:test`, `bridge-cli:typecheck`, `bridge-cli:build`, and focused SDK/CLI tests as needed for unchanged SDK behavior.

## RED Evidence

- `moon run -f bridge-cli:test` failed before implementation as expected in `tests/package-boundary.test.ts`: `src/cli.ts` still contained the entrypoint guard helper.

## GREEN Evidence

- `moon run -f bridge-cli:test`: 22 files passed, 109 tests passed, 13 skipped.
- `moon run -f bridge-cli:typecheck bridge-cli:build bridge-sdk:typecheck bridge-sdk:test`: 5 tasks completed; `bridge-sdk:test` passed 48 tests.
- `moon run -f bridge-cli:lint bridge-sdk:lint`: completed successfully; `bridge-sdk:lint` reported existing `noExplicitAny` warnings in `src/types.ts`.
