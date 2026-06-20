---
id: T421
title: "Use sandbox process API for validator"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-20T06:18:08Z
updated_at: 2026-06-20T06:22:14Z
---

## Requirements

- Rebuild PR #217 on top of `branch/bridge-finality-hotfix` with a limited validator-only scope.
- Replace the bridge-validator's pid-file/nohup process wrapper with Cloudflare Sandbox process APIs: `startProcess`, `getProcess`, `getProcessLogs`, and `killProcess`.
- Preserve the validator contract that each run launches exactly one high-level `zeko-bridge bridge --json --verbose` command and keeps it observable until completion or timeout.
- Keep existing timeout semantics unless a separate change explicitly revises validator latency limits.
- Remove old actions-dashboard changes, stale finality notes, incomplete live verification tasks, and shell-script implementation-detail tests from the PR diff.

## Test Plan

- BDD. First update bridge-validator tests to describe the process API behavior: launch through `startProcess`, status through `getProcess`, diagnostics/output through `getProcessLogs`, and termination through `killProcess`.
- RED command: `moon run bridge-validator:test -f` should fail before implementation because the current code still expects shell pid files and `sandbox.exec`.
- GREEN commands: `moon run bridge-validator:test -f`, `moon run bridge-validator:typecheck -f`, `moon run bridge-validator:lint -f`, `moon run bridge-validator:build -f`, and `git diff --check`.

## RED Evidence

- `moon run bridge-validator:test -f` failed as expected after updating process API tests. Failures included `sandbox.exec is not a function` in `startBridgeCommand`, `sandbox.readFile is not a function` in status/diagnostics helpers, and the status endpoint returned `ok: false` instead of a running `getProcess` result.

## GREEN Evidence

- `moon run bridge-validator:test -f` passed: 4 test files, 43 tests.
- `moon run bridge-validator:typecheck -f` passed.
- `moon run bridge-validator:lint -f` passed.
- `moon run bridge-validator:build -f` passed.
- `git diff --check` passed.
