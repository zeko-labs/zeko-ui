---
id: T112
title: "Standardize simple npm release workflows"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T01:10:31Z
updated_at: 2026-03-24T01:13:11Z
---

## Requirements

- Make the simple npm package release workflows use one consistent structure and publish pattern.
- Keep `faucet-cli` as the only special-case workflow because it publishes platform-specific binary packages.
- Align `release-bridge-cli.yaml` with the same shape used by the other simple npm packages so local tarball publishing is unambiguous and does not depend on npm path parsing quirks.
- Preserve existing behavior for version checks, `workflow_call` entrypoints, permissions, and downstream sync/github-release jobs unless a change is required for consistency.

## Test Plan

- TDD
- RED first: confirm the current simple workflows are structurally inconsistent, and document why an automated workflow harness does not exist yet for GitHub Actions YAML in this repo.
- GREEN second: standardize the workflow files and validate the resulting structure with targeted file inspection and command-based checks.

## RED Evidence

- `nl -ba .github/workflows/release-graphql.yaml | sed -n '1,120p'`
  `nl -ba .github/workflows/release-bridge-sdk.yaml | sed -n '1,120p'`
  `nl -ba .github/workflows/release-bridge-cli.yaml | sed -n '1,160p'`
  showed that `graphql` and `bridge-sdk` already share the same two-job shape (`version-check` + `publish`), while `bridge-cli` diverges with an extra artifact handoff `build` job and a different publish path contract.
- `git diff --no-index -- .github/workflows/release-bridge-sdk.yaml .github/workflows/release-bridge-cli.yaml`
  confirmed the inconsistency is structural, not just package-specific substitutions.
- Test Strategy Exception: this repo does not currently have an automated harness that executes or schema-validates GitHub Actions workflow YAML locally, so RED is recorded through structural inspection before the workflow refactor.

## GREEN Evidence

- `ruby -e 'require "yaml"; %w[.github/workflows/release-graphql.yaml .github/workflows/release-bridge-sdk.yaml .github/workflows/release-bridge-cli.yaml .github/workflows/release-faucet-cli.yaml].each { |f| YAML.load_file(f); puts "OK #{f}" }'`
  parsed all four release workflows successfully after the refactor.
- `git diff --no-index -- .github/workflows/release-bridge-sdk.yaml .github/workflows/release-bridge-cli.yaml`
  now shows the simple-package publish flow is aligned: both use `workflow_call` + `workflow_dispatch`, `version-check`, and a single `publish` job that installs dependencies, runs `pnpm exec moon run <pkg>:build`, packs inside the package directory, and publishes the local tarball from that directory.
- `rg -n "download-artifact|upload-artifact|path: artifacts/|workflow_dispatch:" .github/workflows/release-*.yaml`
  confirms artifact handoff logic now exists only in `release-faucet-cli.yaml`, which is the intended special case.
