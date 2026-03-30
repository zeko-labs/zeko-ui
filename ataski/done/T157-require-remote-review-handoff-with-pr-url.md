---
id: T157
title: "Require remote review handoff with PR URL"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-25T10:21:22Z
updated_at: 2026-03-25T10:21:22Z
---

## Requirements

- Make the repo instructions explicit that review handoff requires committed and pushed work, not just local validation.
- State that when GitHub access is available, the main agent should open or update the PR and return the PR URL.
- Remove ambiguity so that local-only completion is never treated as sufficient review handoff unless the user explicitly asks for that.

## Test Plan

- BDD.
- Verify the updated wording explicitly covers commit, push, and PR URL handoff.

## RED Evidence

- The prior instructions covered commit-and-push for a named PR branch/worktree request, but they still left room to stop short of opening a PR and returning a review URL.

## GREEN Evidence

- `AGENTS.md` now states that local-only completion is insufficient for review handoff, that committed and pushed work is mandatory, and that the main agent should open or update the PR and return the PR URL when GitHub is available.
