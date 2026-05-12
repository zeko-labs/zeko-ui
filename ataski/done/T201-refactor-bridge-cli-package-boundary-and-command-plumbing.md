---
id: T201
title: "Refactor bridge CLI package boundary and command plumbing"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-12T22:35:22Z
updated_at: 2026-05-12T22:49:39Z
---

## Requirements

- Base the cleanup branch on PR 163 (`branch/t165-bridge-cli-sdk-resume-fix`) and prepare it for a new PR targeting that branch.
- Treat `@zeko-labs/bridge-cli` as a CLI package, not a public SDK. The built package must expose only the CLI entrypoint and must block package-root/deep imports of internal command/core modules.
- Keep repository tests able to exercise source internals directly where needed, but do not publish a root API or generated declaration surface for internals.
- Reduce obvious CLI verbosity by extracting shared command argument parsing and command-tree helpers instead of repeating string/alias parsing in `bridge` and `operation`.
- Preserve existing CLI behavior, command names, poll/retry delay flags, timeout flag support, and session flow behavior.
- Use existing SDK and xstate boundaries; do not add new runtime libraries.

## Test Plan

- TDD for package boundary: add tests that inspect the built package metadata/config and fail while `src/index.ts` is emitted and internals are exported.
- TDD for shared command plumbing: add or update tests around aliased numeric argument parsing through public command behavior, then refactor duplicated parsing into shared helpers.
- GREEN validation: run the bridge CLI test, typecheck, and build tasks through `moon run` from the repo root.

## RED Evidence

- `moon run bridge-cli:test -f` after adding package-boundary and command-args tests failed as expected:
  - `tests/command-args.test.ts` could not import `../src/core/command-args`.
  - `tests/package-boundary.test.ts` showed `package.json` has no `exports`, `tsdown.config.ts` still builds `./src/index.ts`, `src/index.ts` still exists, and `src/cli.ts` still exports `createBridgeCli`.

## GREEN Evidence

- `moon run bridge-cli:test -f` passed: 18 test files, 83 tests passed, 13 skipped.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run bridge-cli:lint -f` passed with Biome checking 50 files and no fixes.
- `moon run bridge-cli:build -f` passed and emitted only `dist/cli.js`.
- `pnpm --dir packages/bridge-cli pack --pack-destination /tmp/bridge-cli-pack-check` produced a tarball containing only `.env.example`, `README.md`, `dist/cli.js`, and `package.json`.
- `node --input-type=module` from `packages/bridge-cli` confirmed package self-import has `rootKeys: []` and deep import `@zeko-labs/bridge-cli/dist/cli.js` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
