---
id: T097
title: "Commit and push bridge observability fixes"
status: done
blockedBy:
  - T095
  - T096
owner: codex
created_at: 2026-03-12T16:56:14Z
updated_at: 2026-03-12T16:57:23Z
---

## Requirements

- Stage the current bridge observability follow-up changes without touching the unrelated `apps/bridge-ui/.sentryclirc` edit.
- Commit the changes with a Conventional Commit message and a confirmed Lefthook run.
- Push the updated `branch/bridge-observability-followup` branch to `origin`.

## Test Plan

- BDD.
- RED first: do not publish until the tracked follow-up fixes are staged cleanly and the unrelated `.sentryclirc` edit remains unstaged.
- GREEN second: create the commit with a successful hook run and push it to the existing review branch.

## RED Evidence

- Publish remained blocked until the intended bridge observability files were staged cleanly and the unrelated `apps/bridge-ui/.sentryclirc` edit was confirmed to remain unstaged.

## GREEN Evidence

- Staged the telemetry relocation, portable metrics runner updates, and the corresponding Ataski task files without touching `apps/bridge-ui/.sentryclirc`.
- Created commit `649a9b7` with message `fix(bridge-ui): relocate telemetry and harden report runner`.
- Lefthook `pre-commit` ran successfully during the commit, including `pnpm exec moon run :lint-fix` and `pnpm exec moon run :format-all-fix`.
- The hook run completed successfully without reporting any bridge-ui rewrites that required a second implementation pass.
