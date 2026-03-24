# Use Zeko

Installable Zeko skill for agents.

This skill is mirrored to a public mirror repository for installation. The mirror is updated by `sync-use-zeko.yaml`.

## What is included

- `zeko/SKILL.md` as the installable skill entrypoint
- docs-first references inside `zeko/references/`
- public Zeko docs links plus runnable endpoint and `curl` examples
- deterministic validation plus manual `opencode` dogfood evals

## Validation

```bash
moon run use-zeko:test
moon run use-zeko:check
```

## Manual Opencode Eval

Run the real prompt set through a local `opencode` agent:

```bash
moon run use-zeko:eval-opencode
```

Useful environment variables:

```bash
USE_ZEKO_EVAL_CASE=bridge-sdk-config moon run use-zeko:eval-opencode
USE_ZEKO_EVAL_ATTEMPTS=3 moon run use-zeko:eval-opencode
USE_ZEKO_EVAL_MODEL=some/provider-model moon run use-zeko:eval-opencode
USE_ZEKO_EVAL_ALLOW_WEBSEARCH=1 moon run use-zeko:eval-opencode
```

This manual eval verifies actual agent behavior by checking the `opencode` JSON event stream for reads of `.agents/skills/zeko/SKILL.md`, reads of the expected reference files, and answer fragments expected for each prompt.
By default it lets `opencode` use its configured default model; `USE_ZEKO_EVAL_MODEL` is only an override.

The shipped skill is intentionally lean and only references public URLs plus files inside `zeko/`.
