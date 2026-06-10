---
id: T275
title: "Install nu through proto toolchain setup"
status: done
blockedBy: []
owner: Codex
created_at: 2026-05-27T09:28:01Z
updated_at: 2026-05-27T09:34:20Z
---

## Requirements

- Investigate why `moonrepo/setup-toolchain@v0` did not make `nu` available on PATH in `Bridge Mainnet Release` run `26502419878`.
- Keep Bridge UI deploy Moon tasks invoking bare `nu`; do not rewrite them to `proto run nu --`.
- Fix repo toolchain configuration so the existing setup-toolchain `proto install` phase installs the pinned Nushell version and the existing proto shims PATH entry can resolve `nu`.
- Preserve the existing `proto-nu` plugin locator.
- Validate the corrected proto configuration in an isolated proto home, then dispatch the mainnet release workflow again and monitor it to completion.

## Test Plan

- DDD: use the failed run log showing `setup-toolchain` added `/home/runner/.proto/shims` and `/home/runner/.proto/bin` to PATH, then installed `node`, `pnpm`, `proto`, `bun`, `npm`, `moon`, and `rust`, but not `nu`; `bridge-ui:deploy-mainnet` then failed with `/usr/bin/bash: line 1: nu: command not found`.
- Validate current local config with an isolated `PROTO_HOME` to prove `.prototools` only has `[tools.nu]` config and no installable top-level `nu` declaration.
- Validate the fixed config with an isolated `PROTO_HOME` to prove final proto configuration includes top-level `nu = "0.112.2"`.
- Run a local Moon/proto setup check that confirms `nu --version` resolves from the proto-managed toolchain.
- After committing and pushing, dispatch `Bridge Mainnet Release` and monitor it to completion.

## RED Evidence

- `Bridge Mainnet Release` run `26502419878` shows `moonrepo/setup-toolchain@v0` added `/home/runner/.proto/shims` and `/home/runner/.proto/bin` to PATH, then installed `node`, `pnpm`, `proto`, `bun`, `npm`, `moon`, and `rust`; `nu` was absent from that install set.
- The same run failed at `bridge-ui:deploy-mainnet` with `/usr/bin/bash: line 1: nu: command not found`, while Moon reported it was running `nu ./deploy-ci.nu`.
- `proto debug config` with an isolated `PROTO_HOME` shows the current local `.prototools` contains `[tools.nu] version = "0.112.2"` and the plugin locator, but final configuration has no top-level `nu` tool declaration, so `proto install` has no local `nu` tool to install.

## GREEN Evidence

- Updated `.prototools` so Nushell is declared as a top-level tool with `nu = "0.112.2"` and preserved `[plugins] nu = "github://hebilicious/proto-nu"`.
- `proto debug config` with an isolated `PROTO_HOME` now shows final configuration includes top-level `nu = "0.112.2"`.
- `proto install nu --yes && nu --version` installs/resolves Nushell `0.112.2`.
- `SENTRY_ORG= SENTRY_DSN_PUBLIC= SENTRY_AUTH_TOKEN= SENTRY_PROJECT= BRIDGE_UI_DEPLOY_TARGET=mainnet WORKERS_CI_COMMIT_SHA=test CI=true moon exec --ignore-ci-checks bridge-ui:deploy-mainnet` starts `nu ./deploy-ci.nu` and fails inside the Nushell script with `Missing required environment variable SENTRY_ORG`, proving the Moon task can resolve `nu` from the prepared toolchain environment.
