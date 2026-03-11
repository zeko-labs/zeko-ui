---
name: AGENTS.md Reference
description: You should update the AGENTS.md file to include Ataski.
---

Use this section in `AGENTS.md` to enforce Ataski usage:

```md
## Non-Negotiable Workflow

Scope: this workflow is mandatory for source code changes (runtime, business logic, and tests).  
For chore/tooling/config/docs-only changes, this workflow is optional unless explicitly requested.

1. To keep track and organize your work, you must use the `ataski` skill.
2. Use Ataski as the shared coordination board for repository task status and handoffs.
3. In multi-worktree flows, the main agent is the coordinator. Create one canonical feature worktree in `ataski/worktrees/` (or the configured `worktreesDir`) on the parent feature branch; keep that directory git-ignored; do not maintain task-local copies of the Ataski board.
4. Enforce task dependencies with `blockedBy` as a hard gate: do not claim/start a task until all `blockedBy` task IDs are `done`.
5. Break the work into explicit parallelizable tasks first, prepare shared board updates in the canonical feature worktree, then create one dedicated task worktree and branch per parallel task.
6. Only the main agent updates the board, and only in the canonical feature worktree.
7. Follow the concrete task format, ID allocation, lifecycle, tracker rules, and source-code workflow gates from the `ataski` skill definition, including writing task requirements and a test plan that chooses BDD, TDD, or DDD before source edits.
8. If `ataski/config.jsonc` exists, it overrides defaults and must be followed.
9. For source-code changes, this `AGENTS.md` section is the mandate to use Ataski, and the `ataski` skill is the authoritative operational procedure (task lifecycle ordering, testing gates, and completion checks).
10. Sub-agents work only in task worktrees. They implement code and report completion and test evidence; they do not edit the board.
11. When work finishes in a task worktree, the main agent merges that branch back into the canonical feature branch, then updates the board in the canonical feature worktree. Completed tasks must be moved to `done` before the main agent opens, updates, or pushes PR branches that represent that completed work.
12. `done`-state board updates must be committed in the canonical feature PR branch so they land with merge; do not defer them as post-merge edits on `main`.
13. For new features or other behavior-bearing work, missing test harnesses or scaffolding status do not excuse skipping automated tests; agents must create the harness first or split out a prerequisite task.
14. The chosen test method must guide correctness; agents must write thorough, meaningful tests and must not write shallow tests just to make a task appear green.
15. Task content must be self-contained: each task must include all context needed to complete it so a sub-agent can execute without asking the main agent for missing details.
16. In plan mode, the agent must use Ataski to express the plan: every meaningful plan item must be written as an Ataski task and divided for maximum safe parallelization.
17. Sub-agents must not open/update/push PR branches; only the main agent performs PR publication steps.
```
