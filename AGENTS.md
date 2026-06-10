# Instructions

This monorepo hosts Zeko UI apps and libraries.

## Big picture

This is a monorepo using pnpm as the package manager, and moon as the task runner. The projects are defined in `.moon/workspace.yaml` and `pnpm-workspace.yaml`.

### Codebase Overview

The Zeko UI monorepo contains 18 projects across 3 categories: frontend applications (bridge, faucet, leaderboard, docs), shared packages (bridge-sdk, graphql, design system, Nuxt layer), and backend services (leaderboard/actions APIs and indexers, Mina proxies).

**Stack**: Nuxt 3 + Vue 3, XState, o1js (Mina blockchain), Cloudflare Workers + Durable Objects, PostgreSQL + Drizzle ORM, GraphQL (gql.tada)

**Structure**: Apps consume shared packages; services run on Cloudflare/Northflank; Moon orchestrates all tasks.

For detailed architecture, module guides, and data flows, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Common tasks and commands

To install everything, run `pnpm i` from the root.

- Run all commands from the root using `moon run`. For example, to run the `dev` task for the `faucet-ui` project, go to the repository root and run `moon run faucet-ui:dev`. Do not change into a project directory to run `moon` commands; they must be executed from the root.
- `moon run` is the only supported command interface for repository workflows such as `dev`, `typecheck`, `test`, `build`, and `deploy`.
- In GitHub Actions or other CI workflows, do not mark workflow-only tasks with `options.runInCI: true` just to make them invocable. That makes them eligible for generic `moon ci` discovery and can cause unrelated CI jobs to run deploy/publish/manual tasks.
- When a workflow must invoke a task that should stay out of generic `moon ci`, use `moon exec --ignore-ci-checks <project>:<task>` after dependencies are installed. Reserve `options.runInCI` for tasks that are intentionally part of the normal CI target set.
- Do not add, invoke, or rely on `package.json` scripts as workflow entrypoints in this repo. If a workflow is missing, add or update the project’s `moon.yml` task instead of adding a new package script.
- Project tasks are defined in each project’s `moon.yml`. Inspect this file _before_ running any commands in a given project.
- You can disable moon caching by passing the `-f` flag to any `moon run` command that has cached results.
- If you need to run a command not specified in `moon.yml`, use `pnpm exec <command>`.

## Cloudflare Workers Builds

- `workers-build.jsonc` files are the source of truth for Cloudflare Workers Builds trigger configuration.
- Before editing or publishing any Workers Builds trigger config, inspect the target project’s `moon.yml` for its `publish-cf-build-config` task and use that task.
- Publish Workers Builds config only through Moon: run `moon run <project>:publish-cf-build-config` from the repo root, or use the underlying `moon run cloudflare-build-config:sync -- <path-to-workers-build.jsonc>` task when a project task does not exist.
- For validation, use `moon run cloudflare-build-config:sync-dry-run -- <path-to-workers-build.jsonc>`.
- Do not call Cloudflare’s Workers Builds API directly from ad hoc scripts, curl, browser tools, or one-off Node snippets to create, patch, or delete build triggers. If the sync task cannot perform the needed operation, stop and report the exact blocker.
- When configuring testnet/mainnet separation, verify `scriptName` names the Worker whose build triggers should run. Changing only the deploy command is not enough. For example, default-branch testnet deploys must target the testnet Worker script, not the mainnet Worker script with a testnet deploy command.
- Keep automatic `main` branch Workers Builds attached only to the intended non-production Worker unless the user explicitly requests automatic mainnet deployment. Mainnet deployment should stay manual/release-workflow driven when that is the established project pattern.

## Testing

When writing tests, never attempt to use workarounds to make test pass.
Never attempt to create mocks unless specifically required.
Never try to skip tests or make dumb assertions just to make test pass.
If a test is failing, take your time to investigate why it is failing without jumping to conclusions.
Handle failures one by one, methodologically, and make sure that the tests are sound, and that they verify the intended behavior.
When testing, prefer using the test tool to run the tests.

## Language Instructions

- Always use Typescript instead of Javascript
- Always use plain CSS with the latest features available in postcss. Do not use libraries like Tailwind or Bootstrap. Use PascalCase for class names. Use CSS nesting when authoring styles.
- Always prefer first principles to adding additional libraries. If using a library is necessary, always ask first before adding it, unless the user explicitly ask for a specific library to implement something.

## Nuxt and Vue Instructions

- Match existing coding style.
- Always use composition API with script setup.

## Notes for this monorepo setup

- Bun is only required when running certain scripts; standard builds use Node.
- Prefer Moon over raw pnpm filters for common workflows to keep consistency with CI tasks.
- **Never manually edit `worker-configuration.d.ts`** — This file is auto-generated by Wrangler. Update `wrangler.jsonc` instead and run `moon run <project>:type-cf` to regenerate.

Zeko UI is a private monorepo, but some packages are published publicly from split repositories. For those packages, the source of truth stays here and GitHub sync workflows export the package directory into a public standalone repo before release. When working on publishable packages, account for both environments: monorepo-only metadata such as `catalog:` and `workspace:` can be valid here, but the sync pipeline must rewrite anything non-publishable before the standalone repo runs its release workflow.

## Release Changesets

- Source changes to publishable packages require a `.changeset/*.md` entry before handoff; use `pnpm changeset` from the repo root and respect `.changeset/config.json` fixed/ignored packages.
- If a required changeset was missed after merge, do not rewrite history. Add a new changeset commit on top of latest `main`.

## Coding Style

- NEVER use hacky workaround for the sake of making things works. Be thorough.
- Your code must be clean and not literred with unnecessary comments.
- Avoid mutating variables and prefer immutability.
- Prefer a functional style, avoiding side effects.
- Prefer readability over cleverness.
- Do not be too cavalier when following instructions. If you are unsure about something, ask for clarification.

## Non-Negotiable Workflow

Scope: this workflow is mandatory for source code changes (runtime, business logic, and tests).\
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
18. If the user asks for a named PR branch or worktree and also asks for implementation, treat publish as implied completion work: after validation passes, the main agent must commit the finished changes and push the branch unless the user explicitly says not to.
19. When handing off completed work for review, local-only completion is not sufficient. The main agent must ensure the work is committed and pushed so the user can review it remotely. If GitHub CLI and credentials are available, the main agent should also open or update the PR and return the PR URL. Do not stop at local validation when remote review is the obvious next step.
20. If commit, push, or PR creation is blocked by missing credentials, missing tooling, branch protection, or network failure, report that specific blocker immediately instead of handing off local-only work as complete.
21. For PR-backed or branch-backed work, a validated local diff is still incomplete work. The default completion sequence is: edit, validate, commit, push, then report back. Do not stop at “fixed locally”, “changes are in the worktree”, or “not committed yet” unless the user explicitly asked to keep the change local.
22. Every completed code/config fix on an active review branch must end in exactly one of two states in the same turn: pushed to the remote branch, or blocked with a concrete reason that prevented push. “Waiting for the user to ask for push” is not a valid default.
