---
id: T436
title: "Harden bridge UI manual verification instructions"
status: done
blockedBy: [T432, T433, T434, T435]
owner: codex
created_at: 2026-06-25T09:23:44Z
updated_at: 2026-06-25T09:39:02Z
---

## Requirements

- Improve repository instructions so future bridge UI debug-mode fixes require browser/manual verification for the relevant debug scenario before PR handoff.
- The instruction must explicitly forbid relying only on narrow unit tests for visible UI/debug-mode bug fixes.
- The instruction must stay general and not include local filesystem paths.
- Include the final manual verification evidence in this task and the PR update.

## Test Plan

- DDD.
- RED: document the current process gap: prior unit-only validation did not catch broken debug scenario UX.
- GREEN: update repo instructions and validate the final PR with browser/manual checks plus automated checks.

## RED Evidence

- Process gap: previous validation relied too much on narrow unit/source checks and did not require browser debug-scenario evidence before PR handoff.

## GREEN Evidence

- Updated `AGENTS.md` testing rules to require UI bug tests to fail for user-visible behavior or record the harness limitation and closest executable boundary coverage.
- Updated `AGENTS.md` bridge debug-mode rules to require browser dev-server scenario evidence before handoff, or an explicit wallet/extension/browser-policy blocker with executable machine/component evidence.
- Final validation: `moon run bridge-ui:format-fix && moon run bridge-ui:test && moon run bridge-ui:typecheck` passed; browser dev-server run reached the no-wallet gate and recorded the mock-backend browser blocker explicitly.
