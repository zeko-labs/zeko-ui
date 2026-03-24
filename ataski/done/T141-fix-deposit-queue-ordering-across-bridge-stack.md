---
id: T141
title: "Fix deposit queue ordering across bridge stack"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T15:40:07Z
updated_at: 2026-03-24T01:09:00Z
---

## Requirements

- Merge `origin/main` into the dedicated PR branch first, then implement the queue-ordering fix on top of that merged state.
- Fix the same deposit finalization rule consistently in `packages/bridge-sdk`, `packages/bridge-cli`, and `apps/bridge-ui`; do not leave the rule enforced in only one layer.
- A target deposit may be finalized only when it is the claimable deposit and there are no earlier non-terminal deposits ahead of it that are non-cancellable.
- Earlier deposits that are provably cancellable are skippable and must not block later finalization the same way as non-cancellable deposits.
- Earlier deposits that are not cancellable must block finalizing the current target until they become terminal.
- Preserve the cancel-first behavior for older deposits: if the relevant older deposit is cancellable and not finalizable, prefer cancellation over treating it as a hard blocker.
- Keep the scope on deposits; do not widen the behavioral change to withdrawals unless a tiny shared helper adjustment is needed.
- If the SDK currently exposes behavior that allows bypassing a non-cancellable earlier deposit, fix it there so CLI and UI cannot drift.

## Test Plan

- DDD
- Extend existing queue/flow tests instead of adding shallow one-off coverage where a harness already exists.
- Add or update regression coverage in `bridge-sdk`, `bridge-cli`, and `bridge-ui` for:
  - an earlier non-cancellable deposit blocking a later seemingly finalizable deposit
  - an earlier cancellable deposit being treated as skippable
  - CLI flow refusing to finalize while a required earlier deposit is pending
  - UI logic not presenting or driving a deposit as finalizable when a required earlier deposit is still ahead
  - existing behavior that drains older required deposit claims before the current bridge completes remaining intact
- Validate with the relevant Moon tasks from the repo root, including at minimum:
  - `moon run bridge-cli:test`
  - `moon run bridge-cli:typecheck`
  - `moon run bridge-cli:lint`
  - relevant `bridge-sdk` test/typecheck targets
  - relevant `bridge-ui` test/typecheck targets

## RED Evidence

## GREEN Evidence

- 2026-03-24: `moon run bridge-sdk:typecheck`
- 2026-03-24: `moon run bridge-sdk:lint` completed with the pre-existing `src/types.ts` `noExplicitAny` warnings only
- 2026-03-24: `moon run bridge-sdk:test`
- 2026-03-24: `moon run bridge-sdk:manual-live-test`
- 2026-03-24: `moon run bridge-cli:typecheck`
- 2026-03-24: `moon run bridge-cli:lint`
- 2026-03-24: `moon run bridge-cli:test`
- 2026-03-24: `moon run bridge-ui:typecheck`
- 2026-03-24: `moon run bridge-ui:lint`
- 2026-03-24: `moon run bridge-ui:test`
