---
name: ataski
description: Manage project work with the Ataski filesystem board. Use when users ask to create, track, claim, move, or complete tasks; coordinate sub-agents with git worktrees; enforce task dependencies with `blockedBy`; or maintain `ataski/tasks.md`.
---

# Ataski

Use this skill to coordinate work through files in an `ataski/` directory.

## Canonical Board Rule

When using git worktrees and sub-agents:

- The main agent is the coordinator.
- Break the work into the smallest sensible set of parallelizable tasks before implementation starts.
- Create one canonical **feature** worktree inside the configured worktree directory (`worktreesDir`, default: `ataski/worktrees/`).
- The canonical worktree MUST use the parent feature branch (example: `feature/faucet-cli`).
- Keep the shared `ataski/` board only in that canonical feature worktree.
- Only the main agent may change task files or `ataski/tasks.md`.
- Sub-agents MUST treat `ataski/` as read-only context.
- Prepare or update the board in the canonical feature worktree first, then create task worktrees for sub-agents.
- When task work is done, the main agent merges each task branch back into the canonical feature branch before review.
- The configured worktree directory MUST be git-ignored.

## Default `config.jsonc`

If `ataski/config.jsonc` exists, it overrides defaults.
Default configuration:

```json
{
  "structure": {
    "0": "todo/",
    "1": "in-progress/",
    "2": "done/"
  },
  "taskID": {
    "prefix": "T",
    "length": 3,
    "example": "T001"
  },
  "taskFrontMatter": {
    "id": "The task ID",
    "title": "The task title",
    "status": "The task status",
    "blockedBy": "Array of task IDs that must be done before this task can start",
    "owner": "Optional current owner/agent",
    "created_at": "The task creation datetime",
    "updated_at": "The task update datetime"
  },
  "testStrategy": "BDD/TDD/DDD (choose the best fit)",
  "tracker": "tasks.md",
  "worktreesDir": "ataski/worktrees/"
}
```

The same default file contents are mirrored in `skills/references/config.jsonc`.

## Structure

Default structure:

```text
ataski/
  todo/
  in-progress/
  done/
  worktrees/
  config.jsonc
  tasks.md
```

If it does not exist, create it before writing tasks.

The default `ataski/worktrees/` directory is reserved for git worktrees and MUST be git-ignored.

## Worktree Configuration

Use `worktreesDir` to control where git worktrees are created.

- Default: `ataski/worktrees/`
- The canonical feature worktree lives inside `worktreesDir`.
- Each parallel task gets its own separate worktree inside `worktreesDir`.
- The canonical branch should use the feature branch name (example: `feature/faucet-cli`).
- Task branches should stay task-scoped (example: `task/T001-short-title`).

## Create Tasks

1. Allocate the next task ID (example: `T001`).
2. Infer a short slugged title (example: `T001-implement-typechecking.md`).
3. Create a new task file in directory `0` (default: `ataski/todo/`).
4. Append a matching entry to `ataski/tasks.md`.

Never reuse task IDs.

For non-trivial source-code work, plan the feature first and split it into explicit tasks that can run in parallel whenever dependencies allow.

When splitting work for sub-agents, write each task so it is self-contained and executable without follow-up clarification.

## Allocate Task IDs

Task IDs must follow `config.jsonc`.
For default config, IDs are `T001`, `T002`, `T003`, ...

Find the next ID by reading `ataski/tasks.md`, taking the highest existing ID, and incrementing it.
If no tasks exist, start at `T001`.

## Task File Naming

Always prefix the file name with the task ID.

Example:

- `T001-short-title.md`

Keep file names lowercase after the ID slug.

## Task File Template

Every task file must be markdown with YAML frontmatter:

```md
---
id: T001
title: "Short task title"
status: todo
blockedBy: []
owner: unassigned
created_at: 2026-02-21T00:00:00Z
updated_at: 2026-02-21T00:00:00Z
---
## Requirements

- Describe the concrete behavior, acceptance criteria, and constraints.

## Test Plan

- State whether the task will use BDD, TDD, or DDD, and describe the intended RED path before implementation (tests, harness updates, or prerequisite test setup).

## RED Evidence

## GREEN Evidence
```

Use `status` values from configured structure.
Default statuses:

- `todo`
- `in-progress`
- `done`

Task content requirements:

- The task content MUST contain all context required to complete the task.
- A sub-agent MUST be able to complete the task without asking the main agent for missing scope, constraints, or acceptance criteria.
- Put all required implementation context in the task file, including relevant requirements, boundaries, dependencies, and validation expectations.
- A task file is not ready for implementation if `Requirements` or `Test Plan` is missing, vague, or leaves key decisions unstated.

## `blockedBy` Rules

`blockedBy` controls dependencies between tasks.

1. Use `blockedBy` as an array of task IDs (example: `blockedBy: [T001, T004]`).
2. Default to an empty array for independent tasks.
3. Reference only IDs that exist in `ataski/tasks.md`.
4. Never include the task's own ID.
5. Reject dependency cycles (direct or transitive) when creating or editing tasks.
6. Treat dependencies as a hard gate: do not claim/start a task until every ID in `blockedBy` is `done`.

## Tracker Workflow

Keep `ataski/tasks.md` as a bullet list in ascending ID order.

Use this line format:

```md
- T001 | todo | title-1 | todo/T001-title-1.md
```

When task state changes, update both:

- task frontmatter (`status`, `updated_at`, optional `owner`)
- matching `ataski/tasks.md` line

In multiple-worktree flows:

- The main agent is the only board coordinator.
- The canonical feature worktree is the only place where the board is writable.
- Task worktrees MUST treat task files and `ataski/tasks.md` as read-only.
- Sub-agents report RED/GREEN results to the main agent; the main agent records that evidence in the task file.
- The main agent updates the board only when planning/claiming work, and after task branches are merged back.
- Board-before-PR gate: for completed task work, the main agent MUST update the task to `done` and sync `ataski/tasks.md` before opening, updating, or pushing a PR/branch that represents that completed work.
- Completion-state board updates (`ataski/done/` move, task `status: done`, and `ataski/tasks.md` sync) MUST be committed on the canonical feature branch so they are included in the PR diff.
- Completion-state board updates MUST NOT be deferred as a post-merge manual step on `main`.

## Lifecycle Rules

Use directory location and `status` together:

1. New task: create in `ataski/todo/` with `status: todo`.
2. Claimed task: move to `ataski/in-progress/` with `status: in-progress`.
3. Completed task: move to `ataski/done/` with `status: done`.

Always update `updated_at` when status or task content changes.

## Source-Code Scope and Hard Gates

The rules in this section apply to **source-code changes** and are hard-gated.

Source-code changes include changes that affect runtime behavior, business logic, test behavior, or execution paths, including examples such as:

- route rewiring
- deleting runtime code paths
- service rewrites
- data-path migrations
- changing tests that validate behavior

Chore-only changes are not source-code changes unless they alter behavior, including examples such as:

- `README` edits
- `.gitignore` edits
- lockfile updates (unless they intentionally change runtime behavior)
- formatting-only or comment-only edits

For source-code changes, the agent MUST follow this ordered workflow and MUST NOT skip or reorder the gates:

1. The main agent creates the task in `ataski/todo/` (`status: todo`).
2. The main agent writes `Requirements` and `Test Plan` in the task file.
3. The main agent moves the task to `ataski/in-progress/` (`status: in-progress`).
4. Record RED evidence in the task file, or (if no test-first strategy is truly applicable) document a `Test Strategy Exception` before source edits. In multiple-worktree flows, sub-agents report this evidence and the main agent records it.
5. Implement code changes.
6. Record GREEN evidence in the task file. In multiple-worktree flows, sub-agents report this evidence and the main agent records it.
7. The main agent moves the task to `ataski/done/` (`status: done`).
8. The main agent updates `ataski/tasks.md` to reflect the final completed state and path.

Apply the normal tracker/frontmatter updates when status changes (create/claim/complete). Step 8 is the required final tracker sync/check.

Pre-edit coordination rule (source-code changes):

- Before any agent edits any source file, the main agent MUST already have created the task, written concrete `Requirements` and `Test Plan` sections, and moved the task to `ataski/in-progress/`.

No retroactive tracking (source-code changes):

- The main agent MUST NOT create or claim a task after source edits have already started.
- The main agent MUST NOT create a new completed task for already-finished untracked source-code work.
- Moving an already-tracked task to `done` after implementation, validation, and merge is required and is not retroactive tracking.

## Test Strategy

Each source-code task MUST choose the test-first method that best matches the work and name it in the `Test Plan`:

- Use `BDD` for user-visible behavior, acceptance criteria, CLI flows, API contracts, and end-to-end scenarios.
- Use `TDD` for implementation-level logic, refactors, utility behavior, and tight feedback loops.
- Use `DDD` for domain rules, invariants, aggregates, value objects, and business-model correctness.

All three methods still follow the same Red/Green discipline:

1. RED first: write meaningful failing tests that express the intended behavior, rule, or acceptance criteria.
2. Record RED evidence in the task file (command + failure summary). In multiple-worktree flows, the main agent records task-file evidence from sub-agent reports.
3. GREEN second: implement the smallest correct change to satisfy the failing tests.
4. Record GREEN evidence in the task file (command + pass summary). In multiple-worktree flows, the main agent records task-file evidence from sub-agent reports.
5. REFACTOR optional: improve the design without changing behavior.

Test gate requirements for source-code changes:

- RED evidence MUST be recorded before implementation edits.
- The chosen test method MUST guide the implementation. Tests exist to define correctness, not to turn the task green with shallow validation.
- Tests MUST be thorough and meaningful for the task's risk and behavior. Write assertions that prove the intended behavior, not placeholder tests that merely execute code.
- If no test-first method is applicable, add a `Test Strategy Exception` section in the task file **before source edits**. This section MUST explain why BDD, TDD, and DDD are all not applicable and what validation will be used instead.
- A `Test Strategy Exception` replaces the RED requirement only. It does not waive GREEN validation.
- GREEN evidence is always required before moving the task to `done`.
- For new features, new packages, service rewrites, route rewiring, and other behavior-bearing work, automated tests are mandatory. Build, lint, typecheck, and manual smoke checks alone do NOT satisfy this requirement.
- Missing test coverage, missing test harnesses, greenfield package setup, or scaffolding work are NOT valid reasons to skip test-first development. The agent MUST first add or extend a test harness, or create a prerequisite task to do so, and then continue with RED/GREEN.
- A full feature or public package MUST NOT use a blanket `Test Strategy Exception` to avoid writing tests for its user-visible behavior.
- If only part of a task cannot be tested first, the exception MUST be narrowly scoped to that part, and the agent MUST still write tests for the remaining behavior or split the work into smaller tasks.

Do not mark task `done` without passing tests (or the documented exception validation) for source-level work.

## Completion Compliance Checklist

Before completing a source-code task, verify all items below:

- task was created before source edits
- task requirements and test plan were written before source edits
- task was moved to `in-progress` before source edits
- RED and GREEN evidence were recorded, or a pre-edit `Test Strategy Exception` plus GREEN evidence was recorded
- task was moved to `done` only after implementation and validation were complete

## AGENTS.md Interaction

Keep and use the `AGENTS.md` guidance (see `skills/references/AGENTS.md`) to mandate Ataski at the project level.

For source-code changes:

- `AGENTS.md` provides the project mandate/policy to use Ataski.
- The `ataski` skill provides the exact operational procedure, lifecycle ordering, and hard gates.
- If `AGENTS.md` says to use Ataski, then the Ataski lifecycle and testing/compliance gates in this skill are mandatory.

## Multi-Agent Coordination

Core rules:

1. The main agent is the coordinator.
2. The main agent owns the canonical feature worktree and the only active `ataski/` board.
3. The canonical worktree MUST use the parent feature branch (example: `feature/faucet-cli`).
4. The main agent creates one task worktree per task branch under `worktreesDir` (example branch: `task/T001-short-title`).
5. Sub-agents work only in task worktrees.
6. Sub-agents never edit the board.
7. The main agent merges task branches and updates the board.

Follow this sequence:

1. The main agent creates the canonical feature branch/worktree first.
2. The main agent prepares the board there and creates the tasks.
3. The main agent claims only tasks whose `blockedBy` entries are already `done`.
4. For each claimable parallel task, the main agent creates a dedicated task branch/worktree from the canonical feature branch.
5. The main agent assigns exactly one sub-agent to each task worktree.
6. Each sub-agent implements only its assigned task and reports completion.
7. The main agent reviews and merges each completed task branch back into the canonical feature branch.
8. After each merge, the main agent updates the task on the canonical board to `done` in the canonical feature branch, commits that board change, then re-checks which blocked tasks are now claimable.
9. Once all task branches are merged, the main agent reviews the complete feature from the canonical feature worktree.
10. The main agent opens or updates the final review/PR from the canonical feature branch.

Coordination constraints:

- Do not claim blocked tasks.
- Do not claim more than one task per agent or sub-agent at a time.
- Only the main agent edits `ataski/`.
- Sub-agents MUST NOT create, claim, move, or complete tasks.
- Sub-agents MUST NOT commit changes under `ataski/`.
- Sub-agents MUST NOT open, update, or push PR branches.
- The main agent MUST include `done`-state board updates in the canonical feature PR branch; never apply them only after merge on `main`.
- Do not edit unrelated task files unless explicitly requested.
- If two agents race for the same task, the first canonical board update wins; other agents must re-pick from `todo`.

## Plan Mode

When an agent is operating in plan mode:

- The agent MUST use Ataski to represent the plan.
- Every meaningful plan item MUST be written as an Ataski task.
- The plan MUST be split into the maximum safe level of parallelizable tasks.
- The plan is not complete until the Ataski tasks capture the full intended work.
- Do not keep extra implementation plan steps outside the Ataski board.

Git/worktree policy prerequisite:

- If project policy (for example `AGENTS.md`) requires git and/or worktrees for task execution and they are unavailable, the agent MUST stop before source edits and ask the user to initialize git or enable the required worktree workflow.
