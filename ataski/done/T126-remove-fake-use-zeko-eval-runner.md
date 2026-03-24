---
id: T126
title: "Remove fake use-zeko eval runner"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T02:05:00Z
updated_at: 2026-03-24T02:08:00Z
---

## Requirements

- Remove the current `runEvals` implementation and any task or CLI path that presents it as a real eval.
- Keep the prompt corpus in `packages/use-zeko/evals/prompts.json`.
- Keep validation focused on deterministic structural, endpoint, and link checks only.
- Update tests so they no longer assert the presence of fake eval execution.

## Test Plan

- DDD. Remove the fake eval surface, then run the package tests and `use-zeko:check` to confirm the remaining validation path still passes.

## RED Evidence

- `runEvals` in `packages/use-zeko/src/index.ts` only ranked reference files by token overlap and asserted string fragments, without invoking any model or agent runtime.
- The CLI and Moon task exposed this lexical check as `eval`, which overstated what it validated.

## GREEN Evidence

- Removed the `eval` Moon task and CLI command.
- Deleted the fake `runEvals` implementation and its prompt-token scoring logic.
- Kept `packages/use-zeko/evals/prompts.json` as a prompt corpus only.
- `moon run use-zeko:test -f`
- `CI=1 moon run -f use-zeko:check`
