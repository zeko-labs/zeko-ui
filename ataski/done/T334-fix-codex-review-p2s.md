---
id: T334
title: "Fix Codex review P2s"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T15:04:58Z
updated_at: 2026-06-12T15:15:53Z
---

## Requirements

- Fix Codex review P2: the dashboard must not report the action-indexer as OK when authenticated `/status` fails.
- Fix Codex review P2: the Cloudflare Access helper must page through list responses instead of assuming page 1 is complete.
- Preserve existing status/control behavior and Access upsert behavior.
- Rerun focused dashboard validation and Codex review.

## Test Plan

- BDD: add/adjust tests for failed authenticated `/status` and paginated Cloudflare list behavior.
- GREEN validation with `moon run -f ops-dashboard:test`, `moon run -f ops-dashboard:typecheck`, `moon run -f ops-dashboard:lint`, `moon run -f ops-dashboard:build`, and Codex review rerun.

## RED Evidence

- `.agents/skills/codex-review/scripts/codex-review --mode branch` reported `[P2] Treat failed status probes as non-OK`.
- `.agents/skills/codex-review/scripts/codex-review --mode branch` reported `[P2] Page through Access list responses`.

## GREEN Evidence

- `probeActionsIndexer` now returns a non-OK state when authenticated `/status` fails even if `/health` is healthy.
- `scripts/configure-access.ts` now reads all Cloudflare list pages using `page`, `per_page=100`, and `result_info.total_pages`.
- Added a regression test for failed authenticated indexer status.
- Added a regression test that imports the Access helper against mocked paginated Cloudflare responses and proves resources on page 2 are updated, not duplicated.
- `moon run -f ops-dashboard:test` passed.
- `moon run -f ops-dashboard:typecheck` passed.
- `moon run -f ops-dashboard:lint` passed.
- `moon run -f ops-dashboard:build` passed.
