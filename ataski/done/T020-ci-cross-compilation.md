---
id: T020
title: "Phase 6: CI cross-compilation and publishing"
status: done
blockedBy: [T018, T019]
owner: main
created_at: 2026-03-01T00:00:00Z
updated_at: 2026-03-02T03:00:00Z
---

## TDD Exception

CI config only. Validated by YAML structure review.

## GREEN Evidence

- Created `.github/workflows/release-faucet-cli.yml`
- 6-target matrix build: macOS (arm64, x64), Linux (x64, arm64 via cross), Windows (x64, arm64)
- Publish job copies binaries to npm platform packages and publishes all 7 packages
- Trigger: tag push `faucet-cli-v*` or manual workflow_dispatch
