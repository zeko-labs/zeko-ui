---
id: T091
title: "Single-command bridge validation and ordered claims"
status: done
blockedBy: [T090]
owner: codex
created_at: 2026-03-11T04:30:00Z
updated_at: 2026-03-11T18:05:00Z
---

Harden the bridge CLI so the high-level `bridge` command is the durable default for agents, handles ordered claims correctly when multiple pending bridge attempts exist, and becomes the only path used by manual and scheduled live validation.

Scope:

- remove the public `--wait` path and make end-to-end waiting the default bridge behavior
- improve progress reporting for long-running bridge operations without producing per-poll spam
- handle ordered claim/finalize progression when earlier pending bridge items block the current attempt
- add manual-only live validation tasks and documentation
- add a minimal Inngest Cloud bridge-validator service and scheduled GitHub Action
- add package/service-level agent docs and operator checklists

## RED Plan

Start with focused failing tests for:

- bridge progress heartbeats and non-spammy long-wait updates
- ordered-claim behavior when earlier pending bridge items exist
- removal of the public `--wait` flag from the high-level command surface
- manual live-validation task coverage helpers
- bridge-validator execution and Slack failure reporting

Validation will use:

- targeted bridge-cli and bridge-validator tests
- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:lint`
- `moon run bridge-cli:build`
- validator-service test task and docs build once the new project exists

## RED Evidence

Recorded in `/Users/hebilicious/GitHub/zeko-ui/ataski/worktree` on 2026-03-11:

- `moon run bridge-cli:test`

Failures reproduced:

- `tests/bridge-command.test.ts` and `tests/cli.test.ts`: the public high-level bridge command still exposes `--wait`
- `tests/bridge-flow.test.ts`: the bridge flow finalizes only once and gets stuck behind earlier queued claims instead of advancing them in order
- `tests/bridge-flow.test.ts`: the bridge flow does not emit heartbeat progress during long waits
- `tests/bridge-flow.test.ts`: transient status-fetch failures still abort the bridge flow instead of being retried

## GREEN Evidence

Validated in `/Users/hebilicious/GitHub/zeko-ui/ataski/worktree` on 2026-03-11:

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:lint`
- `moon run bridge-cli:build`
- `moon run bridge-validator:test`
- `moon run bridge-validator:typecheck`
- `moon run bridge-validator:lint`
- `moon run bridge-validator:build`
- `moon run docs:build`

Confirmed outcomes:

- the high-level `bridge` command no longer exposes a public `--wait` flag and remains the default agent path
- the bridge flow retries transient status/capability-check failures, emits low-noise heartbeats, and advances earlier queued claims before completing the current bridge
- manual live validation now runs only the single `bridge` command in each direction and is excluded from normal test runs
- the bridge-validator service and scheduled dispatch workflow exist with the minimal two-workflow, Slack-on-failure setup
