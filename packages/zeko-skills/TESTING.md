# Zeko Skills Testing

This file is maintainer-only. It stays in the monorepo package and is not synced to the public `zeko-skills` mirror.

## Local Validation

Install dependencies first:

```bash
pnpm install
```

Run the package checks from the repo root:

```bash
moon run -f zeko-skills:test
moon run -f zeko-skills:typecheck
moon run -f zeko-skills:check
moon run -f zeko-skills:validate-public-install
```

Manual ClawHub publication from the repo root:

```bash
CLAWHUB_TOKEN=... \
ZEKO_SKILLS_CLAWHUB_VERSION=0.0.2 \
ZEKO_SKILLS_CLAWHUB_CHANGELOG="Declare OpenClaw metadata and reduce false positives" \
moon run -f zeko-skills:publish-clawhub
```

Automatic ClawHub publication now runs from `.github/workflows/sync-zeko-skills.yaml`
on pushes to `main` that change `packages/zeko-skills/**`.

CI secret setup:

- Run `npx clawhub@latest login` once on a publisher account. The CLI opens a browser and stores a bearer token at `~/Library/Application Support/clawhub/config.json` on macOS.
- Copy the `token` value from that file into the GitHub Actions repository secret `CLAWHUB_TOKEN`.
- The workflow derives a unique semver automatically from `packages/zeko-skills/package.json` plus the GitHub run number and attempt, so CI does not need a manual version input.

`moon run -f zeko-skills:check` runs the local validation gates:

- skill structure and self-contained markdown checks
- endpoint presence checks against canonical repo sources
- live external-link checks
- staged public-mirror surface checks that ensure only `README.md` and `skills/zeko/` are exported

`moon run -f zeko-skills:validate-public-install` is the real `skills` CLI install gate against the published git source. Override the source when validating a non-default branch:

```bash
ZEKO_SKILLS_PUBLIC_SOURCE=https://github.com/zeko-labs/zeko-skills/tree/branch-name moon run -f zeko-skills:validate-public-install
```

## Manual Agent Dogfooding

Run the prompt corpus through a local `opencode` agent:

```bash
moon run -f zeko-skills:eval-opencode
```

Useful overrides:

```bash
USE_ZEKO_EVAL_CASE=bridge-sdk-config moon run -f zeko-skills:eval-opencode
USE_ZEKO_EVAL_ATTEMPTS=3 moon run -f zeko-skills:eval-opencode
USE_ZEKO_EVAL_MODEL=some/provider-model moon run -f zeko-skills:eval-opencode
USE_ZEKO_EVAL_ALLOW_WEBSEARCH=1 moon run -f zeko-skills:eval-opencode
```

## Public Mirror Smoke Test

The public mirror workflow is `.github/workflows/sync-zeko-skills.yaml`. It exports only:

- `README.md`
- `skills/zeko/`

After the mirror updates, a manual public install smoke test is:

```bash
npx skills add https://github.com/zeko-labs/zeko-skills --skill zeko
```
