---
id: T325
title: "pin faucet container toolchain"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-15T10:35:52Z
updated_at: 2026-06-15T10:38:46Z
---

## Requirements

- Update `apps/faucet/Dockerfile` so Cloudflare container builds use the repository-pinned Node/proto toolchain instead of floating `oven/bun:latest` and `bun install -g pnpm`.
- Install and use proto inside the container build so `node`, `pnpm`, and `moon` match `.prototools`.
- Keep the faucet container runtime behavior intact: run the faucet service from `apps/faucet` and expose port `3000`.
- Ensure the Dockerfile remains compatible with the monorepo workspace dependency on `@zeko/networks`.

## Test Plan

- TDD: add a focused static Dockerfile test that fails while the faucet Dockerfile uses floating Bun/latest pnpm and does not install the pinned proto toolchain.
- Validate with the focused faucet test task and Dockerfile boundary test. Attempt a local Docker build only if Docker is available.

## RED Evidence

- `pnpm exec moon run faucet:test -f -- --run test/dockerfile-toolchain.test.ts` failed because `apps/faucet/Dockerfile` still contains `FROM oven/bun:latest` and `RUN bun install -g pnpm` instead of the pinned proto toolchain setup.

## GREEN Evidence

- `pnpm exec moon run faucet:test -f -- --run test/dockerfile-toolchain.test.ts test/worker.test.ts test/cli-network-boundary.test.ts` passed.
- `pnpm exec moon run -f faucet:typecheck` passed.
- `git diff --check` passed.
- `docker build -f apps/faucet/Dockerfile . --target build --progress=plain` could not run because the local Docker/OrbStack daemon was unavailable: `connect: no such file or directory`.
