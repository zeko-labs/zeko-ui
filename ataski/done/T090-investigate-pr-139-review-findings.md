---
id: T090
title: "Investigate PR 139 review findings"
status: done
blockedBy: [T089]
owner: codex
created_at: 2026-03-11T03:10:00Z
updated_at: 2026-03-11T03:35:00Z
---

Investigate the review findings raised against PR 139, determine which are real, and implement fixes only for the valid findings.

Scope:

- inspect the reported `bridge`, `explorer`, `sdk-config`, and `adapter` issues against the current branch
- fix real correctness issues in the bridge CLI
- keep informational-only items unchanged unless they materially improve correctness or maintainability
- add or adjust tests to cover any confirmed bug fixes

## RED Plan

Start by reproducing the recipient/account behavior and amount-conversion risks with focused tests in `packages/bridge-cli/tests/` before changing runtime code.

Validation will use:

- targeted bridge-cli tests for the confirmed findings
- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:lint`
- `moon run bridge-cli:build`

## RED Evidence

Recorded in `/Users/hebilicious/GitHub/zeko-ui/ataski/worktree` on 2026-03-11:

- `moon run bridge-cli:test`

Failures reproduced:

- `tests/bridge-command.test.ts`: when `--recipient` is provided without `--account`, the submitted sender account equals the recipient address instead of the signer-derived sender account
- `tests/format.test.ts`: exact MINA-to-nanomina conversion helper is missing, so decimal conversion remains on the floating-point path

## GREEN Evidence

Validated in `/Users/hebilicious/GitHub/zeko-ui/ataski/worktree` on 2026-03-11:

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:lint`
- `moon run bridge-cli:build`

Confirmed fixes:

- `bridge --recipient` no longer overrides the sender account; sender resolution and destination recipient are handled independently
- MINA string amounts are converted to nanomina with exact bigint parsing instead of floating-point arithmetic
- `sdk-config.ts` uses the public bridge-sdk type export instead of a relative source import
- dead explorer URL conditional was removed
- bridge initialization cache now drops rejected promises so a transient init failure can be retried
