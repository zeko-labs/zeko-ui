---
id: T166
title: "Fix zeko-skills archive endpoint check"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-04T17:18:08Z
updated_at: 2026-05-04T17:19:19Z
---

## Requirements

- Fix the current `zeko-skills:check` failure caused by the stale archive endpoint expectation in `packages/zeko-skills`.
- Keep the change minimal and local to the `zeko-skills` validation source of truth plus any narrowly-scoped test coverage needed to lock it in.
- Do not touch unrelated docs, workflows, or service behavior unless the check proves they are the real source of truth.

## Test Plan

- DDD: reproduce the current `moon run -f zeko-skills:check` failure first, then rerun the same command after the patch.
- Run the smallest relevant `zeko-skills` test target that covers the updated endpoint expectation.

## RED Evidence

- `moon run -f zeko-skills:check` failed with:
  `Endpoint minascan backup archive missing from services/mina-archive-proxy/worker.ts: https://api.minascan.io/archive/devnet/v1/graphql`.
- `services/mina-archive-proxy/worker.ts` now points at
  `https://devnet-archive-node-api.gcp.o1test.net`, so the stale expectation lived in
  `packages/zeko-skills/src/spec.ts`, not in the service.

## GREEN Evidence

- Updated `packages/zeko-skills/src/spec.ts` so the public Minascan backup archive check stays
  on `packages/graphql/moon.yml`, and added a separate `mina archive proxy upstream` check for
  `services/mina-archive-proxy/worker.ts`.
- Added a targeted assertion in `packages/zeko-skills/tests/spec-and-utils.test.ts` so the two
  archive endpoints stay separated.
- Ran `pnpm exec moon run zeko-skills:test -- tests/spec-and-utils.test.ts`.
- Ran `moon run -f zeko-skills:check`.
