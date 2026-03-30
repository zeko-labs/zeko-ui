---
id: T155
title: "Validate bridge error capture and update policy docs"
status: done
blockedBy:
  - T153
  - T154
owner: codex
created_at: 2026-03-24T15:30:03Z
updated_at: 2026-03-25T02:32:42Z
---

## Requirements

- Validate the combined bridge-ui behavior after T153 and T154 land.
- Run the required verification tasks from the repo root:
  - `moon run bridge-ui:test`
  - `moon run bridge-ui:typecheck`
  - `moon run bridge-ui:build`
- Update the bridge Sentry policy documentation to state that app-originated render and unhandled root errors should reach Sentry while the intentional noise filters remain in place.
- Record concise RED/GREEN evidence for the full validation pass on the Ataski board.

## Test Plan

- BDD.
- RED first: capture the failing targeted test/build evidence from T153 and T154 before the runtime fix is complete.
- GREEN second: run the full bridge-ui verification commands and confirm the date crash path no longer throws while app-originated root errors remain eligible for Sentry capture.

## RED Evidence

- The initial worktree validation attempts surfaced environment-level blockers before the code fixes were complete: the new worktree needed `.nuxt` generation and package-local `node_modules` links before Moon/Vitest could execute the real bridge-ui checks.
- After that setup, the targeted RED tests encoded the missing timestamp helper and app-root retention behavior, and the implementation work cleared those failures before this final validation task started.

## GREEN Evidence

- `moon run bridge-ui:test -f` passed from the repo root in the canonical worktree with the bridge-ui suite green, covering the new timestamp normalization, hardened history rendering, app-root capture helper, and Sentry retention filter behavior.
- `moon run bridge-ui:typecheck -f` passed after binding `beforeSendBridgeUiEvent` to the public `@sentry/nuxt` callback contract, confirming the new client plugin and Sentry config changes compile cleanly.
- `moon run bridge-ui:build -f` passed and produced a deployable Cloudflare/Nitro output. The remaining Sentry warnings were expected release-upload notices about a missing auth token in local build validation, not runtime failures.
- The bridge Sentry capture policy doc now states that app-originated Vue render, `window.error`, and `unhandledrejection` root errors must reach Sentry, while existing intentional noise filters remain active.
