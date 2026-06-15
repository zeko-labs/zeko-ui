---
id: T345
title: "Actions indexer: filter orphaned archive blocks by chainStatus"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-06-15T07:27:19Z
updated_at: 2026-06-15T07:40:00Z
---

## Background

Mainnet inner (L2) action indexing has been stuck with `lastFetchedBlock.inner: null`.
Root cause (verified against the live mainnet L2 archive on 2026-06-13): the L2 archive
database contained blocks from multiple chain instances after the L2 mainnet was
re-genesis'd without wiping the archive DB. The `actions` query for the inner key
returned three action blocks where two (heights 67, 83) belong to an orphaned dead
chain and one (height 144) is canonical. Both branches start from the empty action
state, so the indexer — which assumes the fetched archive actions form one linear
chain — throws `invalid actions chain at index=2` inside `validateEventChain`, fails
every inner cycle, and never inserts the canonical inner action.

The decisive signal is already present in the archive response: dead-chain blocks are
labelled `chainStatus: "orphaned"` while the live chain block is `chainStatus:
"canonical"`. The indexer's actions query simply does not request or use `chainStatus`.

This task implements the indexer-side defense-in-depth fix: select the canonical chain
by dropping orphaned blocks before action processing. This must hold even if the ops
archive reset does not fully purge dead-chain rows, and it also protects the L1 outer
stream because both streams share the same `fetchActions` helper.

Out of scope (do not implement here): the bridge-sdk `fetchUserWithdrawalActions` path
has the same latent exposure, and a live-daemon action-state cross-check could be added
as belt-and-suspenders. Both are deliberately left as follow-ups to keep this PR focused
on the indexer fix.

## Requirements

1. Request `chainStatus` from the archive actions query so the indexer can see each
   block's chain status. The shared query lives at
   `packages/graphql/src/mina-archive.ts` (`fetchActionsQuery`), inside `blockInfo`.
   `chainStatus: String!` already exists on the `BlockInfo` type in the cached
   mina-archive schema, so this is additive and type-safe. Adding the field is safe for
   the existing bridge-sdk consumer because its valibot `v.object` parser strips unknown
   keys.
2. Thread `chainStatus` through the indexer's `ArchiveAction` model:
   - `services/actions/indexer/src/action-processing/types.ts`: add
     `chainStatus: string` to `ArchiveAction["blockInfo"]`. Leave `ArchiveEvent`
     unchanged (events are emitted only for selected blocks).
   - `services/actions/indexer/src/action-processing/process-protocol.ts`: add
     `chainStatus: v.string()` to the `ArchiveActionSchema` `blockInfo` so the worker
     IPC contract stays type-consistent.
   - `services/actions/indexer/src/helper.ts`: add `chainStatus: v.string()` to the
     valibot `blockInfo` schema and populate it in the mapping as
     `chainStatus: a.blockInfo?.chainStatus ?? "canonical"` (default keeps a block when
     the field is absent, i.e. never drop on missing data).
   - `services/actions/indexer/src/benchmark/action-processing-synthetic.ts`: set
     `chainStatus: "canonical"` on generated blocks so synthetic data stays valid.
3. Add a pure, exported selector
   `selectCanonicalBlocks(blocks: ArchiveAction[]): ArchiveAction[]` in
   `services/actions/indexer/src/action-processing/core.ts` that returns the blocks
   whose `blockInfo.chainStatus !== "orphaned"` (keep canonical + pending + any unknown
   status; drop only known dead forks). Order must be preserved.
4. Apply the selector at the ingestion boundary in `helper.ts` `fetchActions`: after the
   blocks are parsed and before `runActionProcessing`, replace `output` with
   `selectCanonicalBlocks(output)` and log how many orphaned blocks were dropped. This
   guarantees worker chunking and `validateEventChain` only ever see the canonical
   chain. Do not change the strict validation semantics of `processArchiveBlocks` or
   `validateEventChain` themselves.
5. The fix must make the real mainnet payload process cleanly: after selection, the
   single canonical inner block (height 144) is processed, producing one event whose
   `afterActionState` equals
   `26077479096813022236874658706981732305841335139411625045249976672961109318180`
   (the live daemon inner account action state), and no `invalid actions chain` error is
   thrown.
6. Because `@zeko-labs/graphql` is a publishable package (fixed with
   `@zeko-labs/bridge-sdk`, not in the changeset ignore list), add a `.changeset/*.md`
   entry with a `patch` bump for `@zeko-labs/graphql` describing the additive
   `chainStatus` field. `@zeko/actions-indexer` is private/ignored and needs no entry.
7. Keep existing indexer tests green (update `test/action-processing.runtime.test.ts`
   `makeBlocks` to set `chainStatus`). No behavior change for already-canonical data.

## Test Plan

Strategy: TDD. The core behavior is implementation-level chain-selection logic with a
tight feedback loop and a known-correct oracle (the real archive payload + the live
daemon account state), which is the ideal fit for unit tests over a pure function.

New test file: `services/actions/indexer/test/action-canonical-filter.test.ts`, driven
by the committed real-data fixture
`services/actions/indexer/test/fixtures/l2-mainnet-orphaned-actions.json` (captured from
the live mainnet L2 archive for inner key
`B62qjDedeP9617oTUeN8JGhdiqWg4t64NtQkHaoZB9wyvgSjAyupPU1`; `chainStatus` per height:
67→orphaned, 83→orphaned, 144→canonical).

RED (write first, expect failure because `selectCanonicalBlocks` does not yet exist):

- `selectCanonicalBlocks(blocks)` returns exactly one block (height 144) and drops the
  two orphaned blocks (heights 67, 83), preserving order.
- `processArchiveBlocks({ blocks: selectCanonicalBlocks(blocks), strategy: "main" })`
  does NOT throw and returns exactly one event whose `afterActionState ===
  "26077479096813022236874658706981732305841335139411625045249976672961109318180"`.

Regression guard (documents the original bug and proves the selector is the fix):

- `processArchiveBlocks({ blocks, strategy: "main" })` on the UNfiltered fixture throws
  `/invalid actions chain at index=2/`.

GREEN: implement `selectCanonicalBlocks`, thread `chainStatus`, wire the selector into
`helper.ts`, update the synthetic generator and runtime-test builder, add the changeset.

Validation commands (from repo root):

- `moon run actions-indexer:test`
- `moon run actions-indexer:typecheck`

## RED Evidence

Command: `pnpm --filter @zeko/actions-indexer exec vitest run test/action-canonical-filter.test.ts`
(upstream deps built first via `moon run actions-indexer:build`).

Result: 3 failed | 1 passed.

- 3 fail with `TypeError: (0 , selectCanonicalBlocks) is not a function` — the selector
  does not exist yet.
- 1 passes: the regression guard `processArchiveBlocks({ blocks, strategy: "main" })` on
  the UNfiltered real fixture throws `invalid actions chain at index=2`, confirming the
  fixture reproduces the production bug.

## GREEN Evidence

- `pnpm --filter @zeko/actions-indexer exec vitest run test/action-canonical-filter.test.ts`
  → 4 passed. `selectCanonicalBlocks` drops the two orphaned blocks (67, 83), keeps the
  canonical block (144), preserves canonical+pending while dropping only orphaned, and
  `processArchiveBlocks` on the selected block yields one event whose `afterActionState`
  equals the live daemon inner action state
  `26077479096813022236874658706981732305841335139411625045249976672961109318180`.
  The regression guard still passes (unfiltered fixture throws `invalid actions chain at
  index=2`).
- Full indexer unit suite (`pnpm --filter @zeko/actions-indexer exec vitest run`):
  44 passed, 6 skipped. The 3 failing suites — `service.integration.test.ts` (Docker
  daemon down), `canonical-progress.test.ts` (no `DATABASE_URL`), and
  `action-processing.proof.test.ts` (worker `.js` resolved from `src`, not `dist`) — are
  pre-existing environmental failures, verified to fail identically on base branch
  `2ed0947d` without these changes. They run via their own moon tasks (Docker/DB/build)
  in CI, not bare `vitest`.
- `moon run actions-indexer:typecheck` → pass.
- `moon run actions-indexer:prove-action-processing` → `passed: true`. Validates the
  worker-subprocess IPC round-trip with the added `chainStatus` field in
  `ProcessRequestSchema` / `ArchiveActionSchema` and the synthetic generator.
- `moon run graphql:typecheck bridge-sdk:typecheck` → pass. The additive `chainStatus`
  query field does not break the publishable graphql package or the bridge-sdk consumer.
- `biome check` and `dprint check` clean on all changed files.

## Notes / Follow-ups (out of scope here)

- `packages/bridge-sdk/src/withdrawals.ts` `fetchUserWithdrawalActions` reads the same
  archive with the same query and has the same latent exposure; it should get the
  canonical filter in a follow-up.
- A live-daemon action-state cross-check (compare the selected chain tip against the
  inner account `actionState`) can be added as belt-and-suspenders later.
- Root-cause ownership is the L2 archive DB pollution after re-genesis (Zeko-core/ops);
  this indexer change is defense-in-depth so the indexer is robust regardless.
