---
id: T116
title: "Unify bridge-cli release topology and GitHub release retries"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T11:42:05Z
updated_at: 2026-03-24T11:46:38Z
---

## Requirements

- Make the bridge-cli release topology uniform with the other simple published packages by moving mirror sync out of `release-bridge-cli.yaml` and into top-level fan-out in `changesets.yaml`.
- Keep the bridge-cli-specific GitHub release behavior, but wire it through the top-level workflow so its dependency on sync is explicit and visible in the run graph.
- Preserve the restored bridge-cli tarball artifact contract needed by the downstream GitHub release workflow.
- Harden `github-release-bridge-cli.yaml` so manual reruns do not fail if the standalone release tag already exists.
- Keep the current publish-step idempotency guard for manual reruns.

## Test Plan

- TDD
- RED first: confirm `bridge-cli` still has inline sync while `graphql` and `bridge-sdk` use top-level sync fan-out, and confirm the GitHub release workflow still unconditionally calls `gh release create`.
- GREEN second: move the bridge-cli sync/release fan-out to the top level, add the GitHub release existence guard, and validate the resulting workflow graph and YAML structure with targeted inspection.

## RED Evidence

- `nl -ba .github/workflows/changesets.yaml | sed -n '57,125p'`
  shows `graphql` and `bridge-sdk` use top-level `sync-*` fan-out jobs, but there is no equivalent top-level `sync-bridge-cli` or top-level bridge-cli GitHub release job.
- `nl -ba .github/workflows/release-bridge-cli.yaml | sed -n '1,140p'`
  shows `release-bridge-cli.yaml` still contains inline `sync` and `github-release` jobs, so bridge-cli remains structurally different from the other simple package pipelines.
- `nl -ba .github/workflows/github-release-bridge-cli.yaml | sed -n '1,120p'`
  shows the GitHub release workflow still unconditionally runs `gh release create "v${VERSION}" ...` with no existence/repair guard for reruns.

## GREEN Evidence

- `ruby -e 'require "yaml"; %w[.github/workflows/changesets.yaml .github/workflows/release-bridge-cli.yaml .github/workflows/github-release-bridge-cli.yaml .github/workflows/sync-bridge-cli.yaml].each { |f| YAML.load_file(f); puts "OK #{f}" }'`
  parsed the updated workflow files successfully after moving the bridge-cli fan-out to top-level jobs.
- `rg -n "sync-bridge-cli|github-release-bridge-cli|workflow_call:|outputs:|gh release view|gh release upload" .github/workflows/changesets.yaml .github/workflows/release-bridge-cli.yaml .github/workflows/github-release-bridge-cli.yaml`
  confirms `changesets.yaml` now owns top-level `sync-bridge-cli` and `github-release-bridge-cli` jobs, `release-bridge-cli.yaml` exposes reusable outputs for `should_release` and `version`, and the GitHub release workflow now repairs/short-circuits reruns using `gh release view` + `gh release upload --clobber`.
- `gh repo create zeko-labs/bridge-cli --public --description "Public mirror of @zeko-labs/bridge-cli from the Zeko UI monorepo." --disable-wiki`
  succeeded and created the empty standalone mirror repo at `https://github.com/zeko-labs/bridge-cli`.
- `gh repo view zeko-labs/bridge-cli --json name,owner,url,defaultBranchRef,isPrivate`
  confirms the repository now exists and is public. It is still empty, so the first successful sync will create its `main` branch.
