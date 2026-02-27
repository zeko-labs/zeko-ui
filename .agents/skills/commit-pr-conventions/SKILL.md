---
name: commit-pr-conventions
description: Use this skill when creating git commits or GitHub PRs in this repo to follow the CI Conventional Commits rules.
---

# Commit And PR Conventions

Use this skill for any task that involves creating commits or opening/updating PRs in this repo.

## Source Of Truth

The CI enforces PR title format in `/.github/workflows/verify-pr.yaml`. Keep this skill aligned with that file if it changes.

## Allowed Types

`feat`, `fix`, `docs`, `test`, `ci`, `refactor`, `perf`, `chore`, `revert`, `release`

## Format

Use Conventional Commits:

`type(scope): summary`

- `scope` is optional and should be short, lowercase, and specific (for example `proxy`, `bridge-ui`).
- `summary` should be imperative, <= 72 chars, and without a trailing period.

## Commit Workflow

1. Run `pnpm install` in the current checkout or worktree before touching git hooks. In a worktree, do not assume dependencies from another checkout are available here.
2. After dependencies are installed, run:
   `pnpm exec lefthook install`
   `pnpm exec lefthook validate`
3. Before committing, confirm `.git/hooks/pre-commit` exists. If it is missing, reinstall Lefthook before continuing.
4. Ensure changes are staged.
5. Pick a type from the allowed list.
6. Write a commit message in the required format.
7. Create the commit without bypassing hooks. Do not use `--no-verify`, and do not disable Lefthook via `LEFTHOOK=0`.
8. Treat any `Can't find lefthook in PATH` or `Unable to find Lefthook` output as a failed commit gate. If that appears, the hook did not run. Do not push. Run `pnpm install`, reinstall hooks, and re-run `git commit` so the final commit is created with a real hook execution.
9. If the hook rewrites files (for example formatting fixes), review the changes, re-stage them, and re-run `git commit` so the hook passes on the final staged content.
10. Never run `git push` after a commit where the hook was skipped, disabled, or failed to start. Only push after a commit whose output shows the hook actually ran.

## PR Workflow

1. Ensure the PR title matches the required format and allowed types.
2. If using `gh pr create --fill`, confirm the latest commit subject already matches the required format.
3. If needed, pass an explicit `--title` or update the title with `gh pr edit --title`.

## Examples

- `feat(proxy): allow all origins`
- `fix(actions-api): handle null origin`
- `chore: update tooling`
