---
id: T092
title: "Replace bridge validator with Cloudflare Workflows"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-11T11:40:00Z
updated_at: 2026-03-11T12:53:10Z
---

Replace the current bridge-validator implementation that uses Inngest with a Cloudflare-based implementation using Workflows and Sandbox, and tighten the operator instructions with exact commands for local validation, first npm publish, OIDC setup, and Slack app setup.

Scope:

- remove Inngest-specific service/runtime and scheduled dispatch flow
- add a Cloudflare Worker service using Workflows and Sandbox to run the published CLI
- keep the validator model minimal: two route executions, one per direction
- update tests for the new validator runtime
- update README/testing/operator documentation with exact commands and setup steps

## RED Plan

Start with focused failing tests for:

- validator execution using Cloudflare Workflows orchestration instead of Inngest handlers
- sandbox command construction for the published `@zeko-labs/bridge-cli` package
- failure reporting payload construction for Slack
- operator documentation references to the new runtime and exact setup commands

Validation will use:

- `moon run bridge-validator:test`
- `moon run bridge-validator:typecheck`
- `moon run bridge-validator:lint`
- `moon run bridge-validator:build`
- `moon run bridge-cli:test`
- `moon run docs:build`

## RED Evidence

Recorded in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-11:

- `moon run bridge-validator:test`

Failures reproduced:

- `tests/validator.test.ts`: `buildBridgeProcessScript` does not exist, so the service cannot yet build a Cloudflare Sandbox execution script for the published `bridge` command
- `tests/validator.test.ts`: `buildScheduledValidations` does not exist, so the service cannot yet create the two scheduled Cloudflare Workflow runs
- `tests/validator.test.ts`: `readValidatorEnv` still requires `INNGEST_EVENT_KEY`, proving the validator is still coupled to the wrong runtime

## GREEN Evidence

Validated in `/Users/hebilicious/GitHub/.ataski/worktrees/canonical-bridge-cli` on 2026-03-11:

- `moon run bridge-validator:type-cf`
- `moon run bridge-validator:typecheck`
- `moon run bridge-validator:test`
- `moon run bridge-validator:lint`
- `moon run bridge-validator:build`
- `moon run bridge-cli:test`
- `moon run docs:build`

Confirmed outcomes:

- the validator runtime no longer depends on Inngest and now uses Cloudflare Cron, Workflows, and Sandbox
- the scheduled validator still runs exactly two route checks by executing only the published high-level `bridge` command
- operator docs now include exact shell commands for local bridge validation, first npm package claiming, npm trusted-publisher setup, Slack app creation, and Cloudflare deployment
