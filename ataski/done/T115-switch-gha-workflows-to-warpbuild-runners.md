---
id: T115
title: "Switch GitHub Actions workflows to WarpBuild runners"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T11:11:08Z
updated_at: 2026-03-24T11:12:19Z
---

## Requirements

- Update every GitHub Actions job in `.github/workflows/` that currently uses `ubuntu-latest` so it uses the existing WarpBuild runner labels instead.
- Choose the smallest practical WarpBuild size per job based on workload, with the goal of reducing cost without under-sizing heavy monorepo CI or release builds.
- Leave non-Ubuntu runners unchanged unless a workflow already uses an Ubuntu runner label.
- Make the change in this dedicated feature worktree, then commit, push, and open a PR for review.

## Test Plan

- DDD: inspect each workflow to classify job cost, update the runner labels, then validate the workflow YAML parses cleanly and review the final diff to confirm every Ubuntu runner reference was migrated.

## RED Evidence

- Baseline workflow audit showed multiple jobs still using `ubuntu-latest` across CI, release, sync, and PR verification workflows.

## GREEN Evidence

- Replaced every `.github/workflows` `ubuntu-latest` job or matrix runner with a WarpBuild label sized to workload: `2x` for lightweight checks/publish steps, `4x` for package build-and-sync jobs, and `8x` for monorepo CI and Linux faucet binary builds.
- Verified no `ubuntu-latest` references remain in workflow files with `rg -n "ubuntu-latest|warp-ubuntu-latest" .github/workflows`.
- Parsed every workflow successfully with `ruby -e 'require "yaml"; Dir[".github/workflows/*.yaml"].sort.each { |f| YAML.load_file(f) }'`.
