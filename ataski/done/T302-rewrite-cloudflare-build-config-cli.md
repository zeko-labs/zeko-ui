---
id: T302
title: "Rewrite Cloudflare build config CLI"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T10:44:23Z
updated_at: 2026-06-10T10:57:02Z
---

## Requirements

- Rewrite `@zeko/cloudflare-build-config` from JavaScript to TypeScript and keep it runnable directly with the repo Node runtime.
- Remove the `triggerTemplateScriptName` mechanism from config parsing, schema, docs, and trigger creation.
- Require create-trigger credentials to come from the operator or workflow environment: `CLOUDFLARE_BUILD_TOKEN_UUID` and `CLOUDFLARE_REPO_CONNECTION_UUID`.
- Add a CLI command that prints the token UUID and repo connection UUID from an existing remote trigger so manual operators can export the values.
- Add meaningful automated tests for config parsing, trigger creation credential behavior, and CLI argument handling before implementation.
- Add a GitHub Actions workflow that detects added or modified `workers-build.jsonc` files and syncs them through the Moon task with the expected Cloudflare environment variables.
- Keep Moon as the only repository workflow entrypoint; update `cloudflare-build-config` tasks instead of adding package scripts.
- Update user-facing README documentation and the JSON schema to match the new TypeScript CLI behavior.

## Test Plan

- BDD: first add tests that exercise the CLI-facing behavior: missing create credentials should fail without consulting a template, provided create credentials should be sent when creating a trigger, the dump command should output `build_token_uuid` and `repo_connection_uuid`, and config parsing should reject legacy `triggerTemplateScriptName`.
- RED evidence will be recorded with the failing `moon run cloudflare-build-config:test -f` output before implementation.
- GREEN evidence will include the package test task, typecheck, lint, and a dry-run workflow syntax sanity check where available.

## RED Evidence

- `moon run cloudflare-build-config:test -f` failed as expected after adding BDD tests. Vitest could not load `../src/cli.ts` from `packages/cloudflare-build-config/tests/cli.test.ts` because the TypeScript CLI rewrite has not been implemented yet.

## GREEN Evidence

- `moon run cloudflare-build-config:test -f`: passed 6 Vitest tests covering CLI argument parsing, legacy template rejection, missing create UUID behavior, UUID-backed trigger creation, and token dump output.
- `moon run cloudflare-build-config:typecheck -f`: passed with `tsc --noEmit -p tsconfig.json`.
- `moon run cloudflare-build-config:lint -f`: passed Biome checks for `src` and `tests`.
- `moon run cloudflare-build-config:format -f`: passed dprint format check.
- `node -e "import('./packages/cloudflare-build-config/src/cli.ts').then((m) => console.log(m.parseArgs(['sync']).command))"`: passed and printed `sync`, proving direct Node `.ts` import works under the repo runtime.
- `find apps services unused -name workers-build.jsonc ... JSON.parse(...)`: parsed all 14 checked-in Workers Build configs after removing `triggerTemplateScriptName`.
- `actionlint -ignore 'label "warp-ubuntu-latest-x64-2x" is unknown' .github/workflows/sync-cloudflare-build-config.yaml`: passed workflow syntax validation; the ignored diagnostic is the repo's existing custom runner label.
