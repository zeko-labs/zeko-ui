---
id: T156
title: "Clarify default publish behavior for named PR worktrees"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-25T10:11:52Z
updated_at: 2026-03-25T10:11:52Z
---

## Requirements

- Identify which existing instructions allowed the agent to stop after implementation and validation without committing or pushing.
- Update the repo instructions so that a user request for a named PR branch or worktree, combined with an implementation request, implies commit-and-push after validation unless the user explicitly opts out.
- Keep the existing publication boundary that only the main agent performs PR publication steps.

## Test Plan

- BDD.
- Confirm the new instruction is explicit enough to remove the ambiguity that caused the conservative stop.

## RED Evidence

- Before this change, the instructions said only that the main agent is responsible for PR publication steps. They did not state whether a named PR/worktree request should imply commit-and-push after the code was finished and validated, which left room for an overly conservative interpretation.

## GREEN Evidence

- `AGENTS.md` now explicitly states that when the user asks for a named PR branch or worktree and asks for implementation, commit-and-push are part of completion by default after validation passes, unless the user says otherwise.
- The instruction preserves the existing boundary that only the main agent publishes PR branches, so the new default is additive rather than conflicting with the existing workflow.
