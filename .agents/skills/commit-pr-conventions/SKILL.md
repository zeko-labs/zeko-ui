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

1. Ensure dependencies are installed, then install and validate git hooks:
   `pnpm exec lefthook install`
   `pnpm exec lefthook validate`
2. Before committing, confirm the `pre-commit` hook is present in `.git/hooks/pre-commit`. If it is missing, reinstall Lefthook before continuing.
3. Ensure changes are staged.
4. Pick a type from the allowed list.
5. Write a commit message in the required format.
6. Create the commit without bypassing hooks. Do not use `--no-verify`, and do not disable Lefthook via `LEFTHOOK=0`.
7. If the hook rewrites files (for example formatting fixes), review the changes, re-stage them, and re-run `git commit` so the hook passes on the final staged content.

## PR Workflow

1. Ensure the PR title matches the required format and allowed types.
2. If using `gh pr create --fill`, confirm the latest commit subject already matches the required format.
3. If needed, pass an explicit `--title` or update the title with `gh pr edit --title`.

## Examples

- `feat(proxy): allow all origins`
- `fix(actions-api): handle null origin`
- `chore: update tooling`
