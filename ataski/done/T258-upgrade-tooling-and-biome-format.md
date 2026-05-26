---
id: T258
title: "Upgrade tooling and Biome format ownership"
status: done
blockedBy: [T257]
owner: codex
created_at: 2026-05-26T11:10:00Z
updated_at: 2026-05-26T11:22:41Z
---

## Requirements

- Turn the existing PR into a broader dependency/tooling upgrade PR covering Nuxt, Moon, Proto, and Biome.
- Upgrade Moon to the latest stable version available through npm/proto and keep `.prototools`, `.moon/toolchains.yml`, and root dev dependencies aligned.
- Upgrade Proto to the latest stable version reported by `proto outdated` and keep the repo toolchain files aligned.
- Upgrade Biome to the latest npm release and use the newer Vue support where practical.
- Move formatting workflows that Biome can own away from dprint while keeping dprint for file types Biome still does not support well in this repository.
- Avoid a broad, low-signal repository reformat unless the formatter ownership change requires it and validation supports it.
- Keep existing Moon workflow conventions; do not add package scripts.
- Update the PR title/body to describe the broader toolchain dependency upgrade.

## Test Plan

- DDD: inspect current tool versions and formatter coverage, then update toolchain pins/configuration and validate the task graph with Moon.
- RED evidence should include the current stale Moon/Proto/Biome versions and current dprint-owned format tasks.
- GREEN evidence should include successful installs, formatter/linter checks, typechecks, and focused tests for changed source-adjacent files.

## RED Evidence

- `proto outdated` reports `moon` current `2.0.3`, newest/latest `2.2.5`.
- `proto outdated` reports `proto` current `0.55.3`, newest/latest `0.57.2`.
- `pnpm view @biomejs/biome version` reports `2.4.15`, while the catalog currently resolves `2.4.2`.
- Root Moon `format-all` and inherited `format` / `format-fix` tasks are still fully owned by dprint.
- `dprint.json` still uses the dprint Biome, markup, Malva, and GraphQL plugins for file classes that current Biome can format.

## GREEN Evidence

- Upgraded `@moonrepo/cli` to `^2.2.5`, `.prototools` `moon` to `2.2.5`, `.prototools` `proto` to `0.57.2`, `.moon/toolchains.yml` proto to `0.57.2`, and catalog `@biomejs/biome` to `^2.4.15`.
- `pnpm i` completed and updated `pnpm-lock.yaml`; `pnpm exec moon --version` reports `moon 2.2.5`; `pnpm exec biome --version` reports `2.4.15`; `proto versions proto` reports latest `0.57.2`.
- `pnpm exec biome migrate --write` reported no migration needed.
- Biome now owns JS/TS/JSON formatting in root and inherited Moon format tasks; dprint remains for Markdown, YAML, Vue/HTML markup, CSS/PostCSS, and GraphQL to avoid unsupported coverage gaps and broad Vue SFC churn.
- Enabled new Biome 2.4.15 Vue lint rules as warnings for Vue files: `noVueVOnNumberValues`, `useVueNextTickPromise`, and `useVueValidVFor`.
- Replaced deprecated VS Code `quickfix.biome` settings with `source.fixAll.biome` using Biome's safe `lint/suspicious/noQuickfixBiome` fix.
- Updated local hooks and release/sync workflows to run `moon run --no-actions` after dependencies are installed, avoiding Moon 2.2.5's redundant dependency setup path that fails while inspecting a pnpm-linked dependency manifest.
- `moon run -f :format-all-fix` completed after the formatter ownership change; it fixed 16 TS/TSX files.
- `moon run -f :format-all` passed.
- `moon run -f bridge-ui:format faucet-ui:format graphql:format bridge-cli:format` passed.
- `moon run -f :lint` passed after the editor settings migration. Existing warning-level findings remain in leaderboard and bridge SDK code.
- `moon run -f faucet:typecheck actions-indexer:typecheck cloudflare-build-config:typecheck sync-standalone-package:typecheck bridge-cli:typecheck zeko-skills:typecheck graphql:typecheck bridge-sdk:typecheck` passed using native `tsgo` package typechecks.
- `moon run -f bridge-ui:typecheck faucet-ui:typecheck` passed using Nuxt/Nuxi typecheck.
- `moon run -f bridge-cli:test faucet:test` passed.
- `pnpm exec moon run --no-actions :format-all` passed.
- `pnpm exec moon run --no-actions :lint` passed; rerunning `pnpm exec moon run --no-actions -f lb-indexer:lint` confirms the deprecated `quickfix.biome` finding is gone and only the existing `noExplicitAny` warning remains.
- `pnpm exec moon run --no-actions bridge-sdk:typecheck bridge-cli:typecheck bridge-ui:typecheck faucet-ui:typecheck` passed.
- `pnpm exec moon run --no-actions bridge-cli:test faucet:test` passed.
