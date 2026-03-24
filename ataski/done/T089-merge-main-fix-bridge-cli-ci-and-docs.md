---
id: T089
title: "Merge main, fix bridge CLI CI, and expand docs"
status: done
blockedBy: [T088]
owner: codex
created_at: 2026-03-10T02:28:26Z
updated_at: 2026-03-10T02:57:26Z
---

Merge the latest `main` into the bridge CLI integration line, resolve conflicts, and fix the follow-up issues raised on the PR.

Scope:

- merge `main` into the bridge CLI task branch and resolve conflicts
- fix CI breakage caused by drift from the latest repo state
- expand the bridge CLI README and publish it into the website docs
- remove the Bun requirement from the end-user TUI path while still using OpenTUI
- add `.env.example`, clarify signer-secret terminology, and strengthen command coverage
- reduce unnecessary type assertions and introduce XState where it improves flow reasoning

## TDD Exception

This task starts with a branch refresh from the latest `main` and conflict resolution. The initial failure mode is expected to come from merge drift and repository-level CI changes rather than a single missing behavior that can be isolated in a small RED test first.

Validation will use:

- merge conflict resolution against the latest `main`
- targeted `bridge-cli` tests expanded for the affected commands
- `moon` package validation and any repo-level checks needed to clear CI regressions

## GREEN Evidence

Validated in `/Users/hebilicious/GitHub/zeko-ui/.claude/worktrees/T089-bridge-cli-refresh` on 2026-03-10 09:57:26 +07:

- `moon run bridge-cli:test`
- `moon run bridge-cli:typecheck`
- `moon run bridge-cli:lint`
- `moon run bridge-cli:build`
- `moon run docs:build`

Key outcomes:

- merged latest `main` into `branch/T089-merge-main-fix-bridge-cli-ci-and-docs` and resolved workflow/config conflicts
- updated bridge CLI docs and included them in the docs site
- removed the end-user Bun installation requirement by respawning the TUI through the bundled `bun` package runtime
- added `.env.example`, renamed signer-secret terminology to signer private keys / signer keys, and expanded command-level coverage across `bridge`, `deposit`, `withdrawal`, `operation`, `doctor`, and `tui`
