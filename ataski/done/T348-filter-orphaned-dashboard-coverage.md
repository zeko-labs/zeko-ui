---
id: T348
title: "Filter orphaned dashboard coverage"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-15T16:51:49Z
updated_at: 2026-06-15T16:54:35Z
---

## Requirements

- The actions dashboard archive coverage probe must not report orphaned archive action rows as missing indexer data.
- The probe must still report canonical and pending archive action rows after the indexer head as missing coverage.
- The fix must stay scoped to dashboard coverage probing and keep existing indexer/SDK canonical filtering behavior unchanged.

## Test Plan

- TDD: add a focused dashboard unit test that first fails because an orphaned action row after `lastFetchedBlock` is counted as missing coverage. Then update the coverage query/mapper so only non-orphaned action rows are summarized.

## RED Evidence

- `moon run -f actions-dashboard:test` failed with the new coverage regression test: expected the L2 coverage probe to count only the pending action at block `1050`, but it counted both the orphaned block `1020` and pending block `1050` (`missingActionCount: 2`, `firstMissingActionBlock: 1020`).

## GREEN Evidence

- `moon run -f actions-dashboard:test` passed: `apps/actions-dashboard/test/ops.test.ts`, 28 tests.
- `moon run -f actions-dashboard:typecheck actions-dashboard:lint actions-dashboard:build` passed, including dashboard typecheck, Biome lint, and Nuxt Cloudflare module build.
