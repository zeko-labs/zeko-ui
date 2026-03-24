---
id: T113
title: "Restore bridge-cli release artifact and document GitHub release coupling"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T01:37:00Z
updated_at: 2026-03-24T01:39:25Z
---

## Requirements

- Restore the `bridge-cli-package` artifact handoff in `release-bridge-cli.yaml` so `github-release-bridge-cli.yaml` can continue downloading the packaged tarball after npm publish succeeds.
- Preserve the simplified single `publish` job shape for `bridge-cli`; do not reintroduce the old separate `build` job unless it is required to satisfy the artifact contract.
- Update the `npm-trusted-publishing` skill to document that downstream GitHub release workflows may depend on packaged tarball artifacts, and that standardizing npm publish flows must preserve or intentionally replace those artifact contracts.
- Keep `faucet-cli` as the only workflow with matrix artifact fan-in.

## Test Plan

- TDD
- RED first: verify the current `bridge-cli` workflow no longer uploads `bridge-cli-package` while `github-release-bridge-cli.yaml` still downloads it, and capture that mismatch as the failing contract.
- GREEN second: restore the artifact upload in the simple publish job, update the skill guidance, and validate the producing/consuming workflow contract with targeted file inspection and YAML parsing.

## RED Evidence

- `nl -ba .github/workflows/release-bridge-cli.yaml | sed -n '40,90p'`
  shows the current `publish` job packs and publishes `bridge-cli`, but no longer uploads a `bridge-cli-package` artifact.
- `nl -ba .github/workflows/github-release-bridge-cli.yaml | sed -n '20,40p'`
  shows the downstream GitHub release workflow still downloads `bridge-cli-package` via `actions/download-artifact@v4`.
- This is a broken producer/consumer contract: the packaged tarball artifact is still required after publish, but the producer step was removed in the standardization refactor.

## GREEN Evidence

- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release-bridge-cli.yaml"); YAML.load_file(".github/workflows/github-release-bridge-cli.yaml"); puts "OK"'`
  parsed both workflows successfully after restoring the artifact producer.
- `rg -n "bridge-cli-package|upload-artifact|download-artifact" .github/workflows/release-bridge-cli.yaml .github/workflows/github-release-bridge-cli.yaml`
  now shows the producer/consumer contract is restored: `release-bridge-cli.yaml` uploads `bridge-cli-package` and `github-release-bridge-cli.yaml` downloads the same artifact name.
- `rg -n "GitHub releases may depend on the packaged tarball artifact|actions/download-artifact|Artifact not found" .agents/skills/npm-trusted-publishing/SKILL.md`
  confirms the skill now documents the downstream GitHub release artifact coupling and the failure mode when that contract is broken.
