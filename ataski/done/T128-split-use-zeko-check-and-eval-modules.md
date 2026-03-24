---
id: T128
title: "Split use-zeko check and eval modules"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T11:20:00Z
updated_at: 2026-03-24T11:26:00Z
---

## Requirements

- Refactor `packages/use-zeko/src` so validation, check orchestration, and opencode eval code are split into domain-focused files instead of a single large `index.ts`.
- Keep the deterministic validation path and the manual `opencode` eval path functionally equivalent after the refactor.
- Remove the hard-coded `opencode/gpt-5-nano` default. The runner should use `opencode`'s default model unless the caller explicitly sets `USE_ZEKO_EVAL_MODEL`.
- Keep the code easy to review: small files, direct imports, minimal cross-file indirection.
- Update docs/tests to reflect the new default-model behavior.

## Test Plan

- DDD. First verify the current local `opencode` default works without `--model`, then refactor by domain and rerun the deterministic tests plus targeted manual `opencode` eval cases.

## RED Evidence

- `packages/use-zeko/src/index.ts` mixed markdown validation, endpoint validation, external link checks, and opencode eval logic in one file, which made review and debugging unnecessarily hard.
- `opencode run --format json "Reply with exactly: DEFAULT_OK"` succeeds locally without any `--model` override, so the hard-coded `opencode/gpt-5-nano` default in the runner was unjustified.

## GREEN Evidence

- Split `packages/use-zeko/src` into domain modules: config, utils, validation, evals, and check orchestration.
- `moon run use-zeko:test -f`
- `moon run use-zeko:check -f`
- `opencode run --format json "Reply with exactly: DEFAULT_OK"`
- `USE_ZEKO_EVAL_CASE=bridge-sdk-config moon run use-zeko:eval-opencode -f`
