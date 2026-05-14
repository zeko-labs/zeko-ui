---
id: T196
title: "Fallback live withdrawal actions"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-13T03:18:37Z
updated_at: 2026-05-13T03:32:02Z
---

## Requirements

- Preserve the bridge SDK behavior that merges archived L2 withdrawal actions with recent live Zeko node actions.
- Prevent page-load pending operation discovery from failing when the live Zeko node rejects an archive-derived `fromActionState` cursor with a GraphQL error like `from <field> not found`.
- When the archive-to-live incremental query fails only because the cursor is unknown to the live node, retry the live query without a cursor and merge the resulting recent actions with archived actions.
- Keep non-cursor live query errors visible rather than silently swallowing unrelated endpoint failures.
- Deduplicate merged actions by action-state identity so archive and live overlap does not create duplicate withdrawals.

## Test Plan

- TDD: first add focused unit coverage for the withdrawal action merge behavior by exercising the bridge SDK internals with mocked archive/live action fetchers.
- RED path: prove the current implementation rejects when `fetchRecentActions(l2Client, pk, lastArchiveActionState)` throws `from <field> not found`.
- GREEN path: implement fallback and dedupe behavior, then run the bridge SDK test suite and relevant type/lint checks through Moon.

## RED Evidence

- `moon run -f bridge-sdk:test` reached the new unit test and failed as expected:
  - `test/withdrawal-finalization-state.test.ts > falls back to cursorless live withdrawal actions when the archive cursor is not retained live`
  - failure: `from 4474967054315016516812122185988395396069982311953508365013897653982583369647 not found`
- The same run also timed out in the pre-existing `test/live.manual.test.ts` live endpoint smoke test; that is unrelated to the new RED assertion and will be tracked separately in final validation.

## GREEN Evidence

- `pnpm exec vitest run test/withdrawal-finalization-state.test.ts`: passed 5 tests, including the new cursorless fallback regression test.
- `moon run -f bridge-sdk:test`: passed 25 tests across 4 automated bridge SDK test files. The normal task now excludes `test/live.manual.test.ts`, which remains covered by the existing `manual-live-test` task.
- `moon run -f bridge-sdk:typecheck`: passed.
- `moon run -f bridge-sdk:lint`: passed with pre-existing warnings in `src/types.ts` for `ExtractInput<T>` using `any`.
- `moon run -f bridge-sdk:build`: passed.
- `moon run -f bridge-ui:typecheck`: passed.
