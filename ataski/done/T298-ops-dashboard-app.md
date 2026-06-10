---
id: T298
title: "ops-dashboard-app"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T11:16:29Z
updated_at: 2026-06-10T11:26:24Z
---

## Requirements

- Create a new local dashboard app in the monorepo for investigating actions infrastructure from one unified page.
- The dashboard must be runnable locally through Moon and must use TypeScript, Nuxt/Vue composition API, and plain CSS.
- The page must show the status of the actions indexer, L1 archive, L2 archive, L1 daemon, and L2 daemon.
- The page must display useful operational details: health/status state, latency, HTTP status, last checked time, chain/archive heights where available, and errors.
- The dashboard must expose buttons for actions indexer control: refresh, start, stop, rebuild, and reset/resync.
- Indexer control requests must go through server-side routes so `ACTIONS_INDEXER_TOKEN` is never shipped to the browser.
- Endpoint URLs must be configurable with environment variables while providing sane production defaults for Zeko-operated endpoints.
- The UI must be dense, scan-friendly, and suitable for repeated operational use.

## Test Plan

- DDD: first verify the dashboard project does not exist and `moon run ops-dashboard:typecheck` cannot resolve it.
- After implementation, run the app-specific typecheck and build through Moon.
- Start the local dev server through Moon and inspect the page in a browser to confirm the dashboard renders without obvious layout breakage.

## RED Evidence

- `moon run ops-dashboard:typecheck` failed with `project_graph::unknown_id`; no project is configured with identifier `ops-dashboard`.
- `test ! -d apps/ops-dashboard` confirmed `apps/ops-dashboard` is absent.

## GREEN Evidence

- `pnpm i` completed and updated the workspace for `@zeko/ops-dashboard`.
- `moon run ops-dashboard:test` passed: 1 test file, 2 tests.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:build` passed.
- `moon run ops-dashboard:lint` passed.
- With `moon run ops-dashboard:dev` running on `http://localhost:3092/`, `curl -fsS /api/ops/status` returned five service probes: actions indexer warn only because `ACTIONS_INDEXER_TOKEN` is not set locally, L1 archive ok, L2 archive ok, L1 daemon ok, L2 daemon ok.
- Browser screenshot automation was not available in this turn: the Browser tool was not exposed and Playwright was only present transitively, not importable from the workspace.
