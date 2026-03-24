---
id: T127
title: "Add real opencode use-zeko eval runner"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T10:44:00Z
updated_at: 2026-03-24T11:07:00Z
---

## Requirements

- Add a local/manual eval path for `packages/use-zeko` that uses a real agent run through `opencode`, not a static proxy.
- Reuse the existing `packages/use-zeko/evals/prompts.json` corpus.
- The eval must verify actual agent behavior by inspecting the `opencode` JSON event stream.
- At minimum, verify that the agent reads `.agents/skills/zeko/SKILL.md`, reads the expected in-skill reference files for the prompt, and returns an answer containing the expected fragments.
- Keep this out of the deterministic CI `check` path. It should be manual/local only.
- Provide a Moon task and package docs for how to run it locally, with a configurable model.

## Test Plan

- DDD. First prove the `opencode` event stream contains read events for skill files and final text content, then implement the runner and verify at least one real prompt case with the local CLI.

## RED Evidence

- `opencode run --format json` emits real agent events, including `read` events for skill/reference files and final `text` output, so static lexical matching was unnecessary and misleading.
- Before the new runner, `packages/use-zeko` had no local/manual path that exercised the skill with a real agent.

## GREEN Evidence

- Added `eval-opencode` as a manual Moon task and CLI command, backed by real `opencode` runs and JSON-event verification.
- `moon run use-zeko:test -f`
- `moon run use-zeko:check -f`
- `USE_ZEKO_EVAL_CASE=bridge-sdk-config USE_ZEKO_EVAL_MODEL=opencode/gpt-5-nano moon run use-zeko:eval-opencode -f`
- `USE_ZEKO_EVAL_CASE=bridge-cli USE_ZEKO_EVAL_MODEL=opencode/gpt-5-nano moon run use-zeko:eval-opencode -f`
