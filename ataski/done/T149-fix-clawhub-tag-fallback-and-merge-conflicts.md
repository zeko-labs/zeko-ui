---
id: T149
title: "Fix ClawHub tag fallback and merge conflicts"
status: done
blockedBy: [T148]
owner: codex
created_at: 2026-03-24T15:05:00Z
updated_at: 2026-03-24T15:58:00Z
---

## Requirements

- Validate the reported `resolveClawhubPublishTags` bug in `packages/zeko-skills/src/publish-clawhub.ts`.
- If the bug is real, fix the implementation so empty or whitespace-only `ZEKO_SKILLS_CLAWHUB_TAGS` falls back to `["latest"]`.
- Add regression coverage for the explicit empty-tag case.
- Check whether PR #158 is conflict-dirty against `origin/main` and, if so, merge `origin/main` and resolve any conflicts cleanly.

## Test Plan

- TDD. Reproduce the tag fallback bug with a unit test first, then fix the implementation and run the package test/check tasks.
- After the code fix, fetch `origin/main`, inspect PR merge status, and merge/resolution-test only if the branch is conflict-dirty.

## RED Evidence

- Current `resolveClawhubPublishTags` uses `...filter(Boolean) || ["latest"]`, which returns `[]` instead of the intended fallback when the env var is present but empty after filtering.

## GREEN Evidence

- `moon run -f zeko-skills:test`
- `moon run -f zeko-skills:check`
- `packages/zeko-skills/tests/publish-clawhub.test.ts` now covers the blank-tag fallback and proves `resolveClawhubPublishTags()` returns `["latest"]` for `ZEKO_SKILLS_CLAWHUB_TAGS=" ,  , "`.
- The branch was merged with `origin/main`, the Ataski ID collision was resolved by preserving `origin/main` task IDs `T139`-`T143` and renumbering the branch-local zeko-skills tasks to `T144`-`T149`, and PR #158 is no longer conflict-dirty locally.
