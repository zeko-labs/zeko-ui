---
id: T114
title: "Fix bridge-cli release retry and sync ordering"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T01:50:30Z
updated_at: 2026-03-24T01:53:16Z
---

## Requirements

- Restore the idempotent publish guard in `release-bridge-cli.yaml` so manual `workflow_dispatch` reruns skip `npm publish` when the current version is already on npm.
- Preserve the ability for downstream `github-release` and `sync` jobs to run after a successful manual retry where npm publish already happened earlier.
- Reintroduce the ordering constraint that ensures the GitHub release in the standalone `zeko-labs/bridge-cli` repo is created only after the sync job has force-pushed the latest package contents to that repo's target branch.
- Keep the simplified publish-job shape and the restored `bridge-cli-package` artifact contract intact.

## Test Plan

- TDD
- RED first: confirm the current workflow lacks the publish idempotency check and that `github-release` no longer waits for `sync`, while the standalone sync workflow force-pushes the branch that the GitHub release targets.
- GREEN second: restore the publish guard and dependency ordering, then validate the workflow structure and producer/consumer sequencing with targeted file inspection and YAML parsing.

## RED Evidence

- `nl -ba .github/workflows/release-bridge-cli.yaml | sed -n '70,110p'`
  shows the current `Publish package` step runs `npm publish` unconditionally, even though `workflow_dispatch` forces `should_release=true` in `version-check`.
- The previous bridge-cli workflow included an idempotency guard in the publish job:
  `PUBLISHED=$(npm view "@zeko-labs/bridge-cli@${VERSION}" version 2>/dev/null || echo "")`
  followed by an early successful exit when the version already existed.
- `nl -ba .github/workflows/release-bridge-cli.yaml | sed -n '85,95p'`
  shows `github-release` currently needs only `[version-check, publish]`, while `sync` also needs `[version-check, publish]`, so those jobs run in parallel.
- `nl -ba .github/workflows/sync-package-repo.yaml | sed -n '100,114p'`
  shows the sync workflow force-pushes `HEAD:${{ inputs.branch }}` into the standalone repo after preparing the package contents, which means the standalone repo branch targeted by the GitHub release can be stale if `github-release` runs first.

## GREEN Evidence

- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release-bridge-cli.yaml"); YAML.load_file(".github/workflows/github-release-bridge-cli.yaml"); YAML.load_file(".github/workflows/sync-package-repo.yaml"); puts "OK"'`
  parsed the updated workflow files successfully.
- `nl -ba .github/workflows/release-bridge-cli.yaml | sed -n '76,100p'`
  shows the publish step now restores the `npm view` idempotency guard and skips cleanly if the version is already published.
- `rg -n "PUBLISHED=|already published, skipping|needs: \\[version-check, publish, sync\\]" .github/workflows/release-bridge-cli.yaml`
  confirms both the retry guard and the restored `github-release` dependency on `sync`.
- `nl -ba .github/workflows/github-release-bridge-cli.yaml | sed -n '32,42p'`
  plus `nl -ba .github/workflows/sync-package-repo.yaml | sed -n '108,116p'`
  confirm the standalone release still targets `main` and the sync workflow force-pushes that branch before `github-release` is now allowed to run.
