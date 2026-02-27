---
name: AGENTS.md Reference
description: You should update the AGENTS.md file to include Ataski.
---

Use this section in `AGENTS.md` to enforce Ataski usage:

```md
## Non-Negotiable Workflow

Scope: this workflow is mandatory for source code changes (runtime, business logic, and tests).\
For chore/tooling/config/docs-only changes, this workflow is optional unless explicitly requested.

1. To keep track and organize your work, you must use the `ataski` skill.
2. Use Ataski as the shared coordination board for repository task status and handoffs.
3. When using git worktrees, keep one canonical `ataski/` board in the main worktree; do not maintain per-worktree copies of the Ataski board.
4. Enforce task dependencies with `blockedBy` as a hard gate: do not claim/start a task until all `blockedBy` task IDs are `done`.
5. For each task, use a dedicated worktree, branch, and PR. Leverage multiple agents and sub-agents when possible.
6. Keep Ataski updated whenever shared task coordination state changes.
7. Follow the concrete task format, ID allocation, lifecycle, tracker rules, and source-code workflow gates from the `ataski` skill definition.
8. If `ataski/config.md` exists, it overrides defaults and must be followed.
9. For source-code changes, this `AGENTS.md` section is the mandate to use Ataski, and the `ataski` skill is the authoritative operational procedure (task lifecycle ordering, TDD gates, and completion checks).
```
