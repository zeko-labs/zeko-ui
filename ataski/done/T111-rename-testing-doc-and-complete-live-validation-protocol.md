---
id: T111
title: "Rename testing doc and complete live validation protocol"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T22:15:00Z
updated_at: 2026-03-19T22:27:00Z
---

## Requirements

- Rename `packages/bridge-cli/testing.md` to `packages/bridge-cli/TESTING.md`.
- Update the manual validation instructions so a fresh agent can run the full bridge validation protocol correctly.
- Cover the sequential three-part validation plan, including the simultaneous deposit+withdrawal run.
- Make the one-command-per-operation and shared-terminal monitoring rules explicit.
- Update package-local references to the renamed document.
- Commit and push the documentation changes.

## Test Plan

- Verify all package-local references now point to `TESTING.md`.
- Review the resulting instructions for the exact fresh-agent workflow they prescribe.

## GREEN Evidence

- Renamed `packages/bridge-cli/testing.md` to `packages/bridge-cli/TESTING.md`.
- Expanded the validation instructions to cover the required three-step protocol:
  - single-command Mina->Zeko run
  - single-command Zeko->Mina run
  - simultaneous overlapping deposit+withdrawal run
- Made the one-command rule, shared-terminal monitoring rule, queue-clearing expectation, and 3-minute reporting cadence explicit.
- Updated package-local references in `AGENTS.md`, `CLAUDE.md`, and `moon.yml`.
- Verification passed:
  - `pnpm exec moon run bridge-cli:lint`
  - package-local reference sweep with `rg -n "testing\\.md|TESTING\\.md" packages/bridge-cli`
