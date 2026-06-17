---
id: T363
title: "Document LLM network label postprocessor"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T11:06:56Z
updated_at: 2026-06-17T11:06:56Z
---

## Requirements

- Record why `stripHTML: false` alone is not enough for `vitepress-plugin-llms` network labels.
- Keep the explanation near the build hook that future maintainers will inspect.
- Preserve the existing generated docs behavior: source markdown uses `NetworkLabel`, while LLM artifacts contain helper-derived display labels.

## Test Plan

- DDD. This is documentation of existing behavior, so verify with the focused docs test and docs build artifact checks.

## Evidence

- Manual verification showed `stripHTML: false` alone keeps raw `<NetworkLabel network="zeko-m:testnet" />` tags in `llms-full.txt`.
