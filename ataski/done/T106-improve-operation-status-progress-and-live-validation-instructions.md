---
id: T106
title: "Improve operation status progress and live validation instructions"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T19:32:00Z
updated_at: 2026-03-19T19:37:00Z
---

## Requirements

- Make `operation status` emit a clear progress message while it is performing live SDK/network refresh work, so the terminal does not look hung before the JSON result appears.
- Keep the final `operation status` payload as one fresh JSON report on stdout.
- Make the bridge-validation instructions crystal clear for agents and humans:
  - a bridge validation only counts if one single long-lived `bridge` command stays alive through completion
  - that same command must be the one polling the SDK/network and signing follow-up transactions
  - agents must not replace the live bridge command with `operation status` loops or other sidecar status polling
  - the main command output must remain directly monitorable by both the agent and the human operator
- Keep the setup simple and avoid encouraging multiple concurrent commands for one validation attempt.

## Test Plan

- RED path:
  - inspect `operation status` and confirm it prints nothing before the final JSON
  - inspect the current validation docs/tasks and confirm they still leave room for the “bridge command stopped, status loop continues” mistake
- GREEN path:
  - add/update operation-command tests for the new progress message
  - update the bridge-cli docs/instructions/tasks to define the single-command validation contract unambiguously
  - rerun focused operation-command tests plus the bridge-cli package test suite

## RED Evidence

- `operation status` currently refreshes live SDK/network state silently and only prints stdout once the refresh is complete, which can look like a hung terminal.
- The current live-validation docs explain the contract, but they do not state strongly enough that agents must keep the original `bridge` process alive and must not substitute a status loop for the real command.

## GREEN Evidence

- `operation status` now emits an immediate stderr progress line before starting the live SDK/network refresh and still prints one fresh JSON report on stdout at the end.
- Bridge-cli manual validation tasks now run the real high-level `bridge` command directly with `--json --verbose` instead of routing through an extra wrapper script.
- The bridge-cli README, testing guide, and AGENTS notes now state the one-command validation contract explicitly:
  - keep the original `bridge` process alive
  - monitor that same process directly
  - never swap over to `operation status` loops or sidecar polling commands for validation
- `pnpm --dir packages/bridge-cli exec vitest run tests/operation-command.test.ts --config vitest.config.ts`
- `moon run bridge-cli:test bridge-cli:typecheck`
