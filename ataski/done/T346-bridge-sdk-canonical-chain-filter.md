---
id: T346
title: "bridge-sdk: filter orphaned archive blocks in fetchActions"
status: done
blockedBy: [T345]
owner: main-agent
created_at: 2026-06-15T10:08:44Z
updated_at: 2026-06-15T10:12:00Z
---

## Background

Companion to T345. The bridge-sdk `fetchActions` (`packages/bridge-sdk/src/utils.ts`)
reads the same Mina archive `actions` query that the indexer uses, and feeds **both**
the deposit path (`packages/bridge-sdk/src/deposits.ts`) and the withdrawal path
(`packages/bridge-sdk/src/withdrawals.ts` `fetchUserWithdrawalActions`).

When the archive holds more than one chain instance (e.g. after an L2 re-genesis that
reused the archive DB), the `actions` response includes orphaned dead-fork blocks
alongside the canonical chain. Unlike the indexer, the SDK's `mapParsedActions` does not
throw on a broken chain — it maps each block independently using `actionStateTwo` as the
per-block before-state. So orphaned blocks are silently turned into **phantom actions**
(e.g. withdrawals that appear in the bridge UI but can never be claimed because they are
not on the live chain).

T345 already added `chainStatus` to the shared `fetchActionsQuery`
(`packages/graphql/src/mina-archive.ts`), so the field is available to the SDK. This task
applies the same canonical-selection fix in the SDK.

## Requirements

1. Parse `chainStatus` in the SDK so it can be used for filtering:
   - `packages/bridge-sdk/src/utils.ts` `ActionOutputsSchema`: add
     `chainStatus: v.string()` to the `blockInfo` object.
   - `parseActionOutputs`: populate `blockInfo.chainStatus` as
     `String(action?.blockInfo?.chainStatus ?? "canonical")` (default keeps a block when
     the field is absent — never drop on missing data).
2. Add a pure, exported selector in `packages/bridge-sdk/src/utils.ts`:
   `selectCanonicalActionOutputs(outputs)` that returns the outputs whose
   `blockInfo.chainStatus !== "orphaned"` (keep canonical + pending + any unknown status;
   drop only known dead forks). Order must be preserved. Its parameter/return type is
   `v.InferOutput<typeof ActionOutputsSchema>`.
3. Apply the selector in `fetchActions` after the recursive fetch completes and before
   `mapParsedActions`, i.e. `return mapParsedActions(selectCanonicalActionOutputs(output))`.
   This protects both deposit and withdrawal action fetching because both call
   `fetchActions`.
4. Do not change `mapParsedActions` semantics; orphaned blocks are removed upstream so
   only canonical/pending blocks are mapped and indexed.
5. `@zeko-labs/bridge-sdk` is a publishable package (fixed with `@zeko-labs/graphql`, not
   ignored). Add a `.changeset/*.md` entry with a `patch` bump for
   `@zeko-labs/bridge-sdk` describing the orphaned-block filtering.

## Test Plan

Strategy: TDD. This is implementation-level filtering logic with a tight feedback loop,
mirroring the existing pure-filter unit test pattern in
`packages/bridge-sdk/test/deposit-v2-filter.test.ts`.

New test file: `packages/bridge-sdk/test/canonical-actions-filter.test.ts` exercising the
exported `selectCanonicalActionOutputs`.

RED (write first, expect failure because `selectCanonicalActionOutputs` does not exist):

- Given a constructed list of parsed action outputs with `blockInfo.chainStatus` values
  `["canonical", "orphaned", "pending"]` (each with distinct heights and action data),
  `selectCanonicalActionOutputs` returns only the canonical and pending entries, in
  original order, and the dropped entry's action data is absent from the result.
- An all-canonical list is returned unchanged (no-op for healthy archives).
- An entry with an empty/missing-defaulted status of `"canonical"` is kept.

GREEN: implement `selectCanonicalActionOutputs`, add `chainStatus` to the schema and
parse, wire the selector into `fetchActions`, add the changeset.

Validation commands (from repo root):

- `moon run bridge-sdk:test`
- `moon run bridge-sdk:typecheck`

## RED Evidence

Command: `pnpm --filter @zeko-labs/bridge-sdk exec vitest run test/canonical-actions-filter.test.ts`

Result: 4 failed with `TypeError: (0 , selectCanonicalActionOutputs) is not a function` —
the selector does not exist yet.

## GREEN Evidence

- `pnpm --filter @zeko-labs/bridge-sdk exec vitest run test/canonical-actions-filter.test.ts`
  → 4 passed. `selectCanonicalActionOutputs` drops orphaned blocks, keeps canonical +
  pending in order, excludes the orphaned block's action data, is a no-op for all-canonical
  input, and keeps default-`canonical` blocks.
- `moon run bridge-sdk:test` → 14 files, 57 tests passed (includes the new file; all
  pre-existing SDK tests unaffected).
- `moon run bridge-sdk:typecheck` → pass.
- `dprint check` clean on changed files. `biome check` reports only a pre-existing
  import-ordering nit in `src/utils.ts` (present on base branch `2ed0947d`, unrelated to
  this change, lines my diff does not touch); the repo pre-commit hook auto-normalizes it.

## Notes / Follow-ups (out of scope here)

- A live-daemon action-state cross-check could still be layered on for both indexer and
  SDK as belt-and-suspenders; not required for correctness once orphaned blocks are
  filtered.
- Root cause remains the archive DB pollution after re-genesis (Zeko-core/ops). Observed
  post-reset: the dead chain is purged and the indexer inner stream no longer errors, but
  the re-synced archive currently starts at ~block 200 so pre-200 history (incl. the
  height-144 inner action) is not yet backfilled — an ops/archive-completeness concern,
  not addressed by this SDK change.
