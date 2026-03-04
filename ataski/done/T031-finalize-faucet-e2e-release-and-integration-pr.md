---
id: T031
title: "Finalize faucet e2e release and integration PR"
status: done
blockedBy: [T028, T029, T030]
owner: codex
created_at: 2026-03-04T12:30:41Z
updated_at: 2026-03-04T13:50:49Z
---

Run the final live verification, cut the `0.1.2` faucet CLI release changes, merge
the task branches into the canonical worktree, and prepare the integration PR.

## TDD Exception

This task is an integration and release task. Validation depends on merging the prepared task branches, running live Cloudflare-backed flows, and using real authenticated GitHub and Cloudflare sessions.

## GREEN

- `moon run docs:build`
- `moon run faucet-cli:test`
- `npx -y @zeko-labs/faucet-cli whoami --token \"$(gh auth token)\" --json`
- `npx -y @zeko-labs/faucet-cli claim B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2 --token \"$(gh auth token)\" --json`
- Repeated the same `claim` command immediately afterward to validate the live rate-limit path.

Validation summary:

- Merged the prepared `T029` and `T032` task branches into the integration branch and verified the integrated worktree.
- `docs:build` and `faucet-cli:test` both passed in the integrated worktree.
- Live `whoami` succeeded with the published `@zeko-labs/faucet-cli` package using the existing local GitHub CLI auth token.
- Live `claim` succeeded and returned transaction hash `5JuaQochYYso4ff2auhKGMLx2mtdgtMRyn5bUhht6tkd1RjhWND8`.
- The immediate repeat claim returned the expected structured `github_claim_rate_limited` response.
