---
id: T317
title: "Fix codex-review deploy gaps"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-12T20:31:07Z
updated_at: 2026-06-12T20:38:10Z
---

## Requirements

- Fix the Codex review findings on PR 208 without changing the larger network nomenclature design.
- Keep bridge-validator scheduled commands compatible with the currently installed `@zeko-labs/bridge-cli@latest` during the Changesets version-PR window, while preserving canonical Zeko-M route reporting and validation.
- Add Workers Build trigger coverage for new workspace package dependencies so Cloudflare auto-builds run when shared network or wallet SDK code changes.
- Prevent the bridge-cli public source mirror workflow from copying installed `node_modules` or other generated dependency artifacts into the mirror.

## Test Plan

- DDD: validate each review finding against the existing behavior, patch the smallest deployment/release boundary, then run the focused unit tests and workflow/package boundary checks that cover those paths.
- RED evidence is the completed `codex-review --mode branch` output reporting the three P2 findings.

## RED Evidence

- `codex-review --mode branch` reported:
  - bridge-validator routes invoke `zeko-m:testnet` before the published `@zeko-labs/bridge-cli@latest` necessarily supports that identifier.
  - Bridge UI Workers Build triggers miss `packages/networks/**` and `packages/sdk/**`.
  - bridge-cli mirror sync copies package directories after `pnpm install`, which can include `node_modules`.

## GREEN Evidence

- Added explicit legacy Zeko-M alias constants and bridge-validator CLI compatibility fields so scheduled validator commands call `zeko:testnet` while summaries and validation remain canonical `zeko-m:testnet`.
- Updated Bridge UI, faucet, faucet-ui, and bridge-validator Workers Build path filters to include the new shared package paths they consume.
- Changed bridge-cli mirror source assembly to use `git archive HEAD packages/bridge-cli packages/networks`, avoiding copied install artifacts.
- Passed `pnpm exec moon run -f networks:test networks:typecheck bridge-validator:typecheck bridge-cli:typecheck`.
- Passed `pnpm exec moon run bridge-validator:test -f -- --run tests/validator.test.ts`.
- Passed `pnpm exec moon run bridge-cli:test -f -- --run tests/package-boundary.test.ts`.
- Passed `git diff --check`.
- Workers Build dry-run commands were attempted for the modified configs, but local validation is blocked by missing `CLOUDFLARE_API_TOKEN`.
