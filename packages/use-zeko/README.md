# Use Zeko

Installable Zeko skill for agents.

This skill is mirrored to a public mirror repository for installation. The mirror is updated by `sync-use-zeko.yaml`.

## What is included

- `zeko/SKILL.md` as the installable skill entrypoint
- docs-first references inside `zeko/references/`
- public Zeko docs links plus runnable endpoint and `curl` examples
- validation and eval tooling

## Validation

```bash
moon run use-zeko:test
moon run use-zeko:check
```

The shipped skill is intentionally lean and only references public URLs plus files inside `zeko/`.
