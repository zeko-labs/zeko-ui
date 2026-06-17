---
id: T379
title: "Render actions API warning"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T13:04:00Z
updated_at: 2026-06-17T13:09:00Z
---

## Requirements

- Make the actions API schema compatibility probe visible in the dashboard UI, not only in the `/api/ops/status` JSON payload or the summary count.
- Render the actions API service near the actions-indexer status so operators can see `Actions API schema is missing finality metadata` without scrolling through unrelated archive/daemon cards.
- Preserve the existing indexer controls and chain insight layout.

## Test Plan

- BDD. Add a narrow dashboard utility/snapshot test proving the actions API probe contributes a warning service to the dashboard snapshot.
- Add a narrow Test Strategy Exception for the Vue template placement itself because this project does not currently have a component/browser test harness for the actions-dashboard page and Playwright is not installed in this workspace. Validate the visual placement through local API data and code review of the template path.

## RED Evidence

- Local dashboard API returns `actions-api` as `warn`, but `apps/actions-dashboard/app/pages/index.vue` only renders `indexerService` in the backend status section and `rowServices(row)` only includes archive/daemon services. There is no template path for the `actions-api` service, so the warning cannot be seen in the dashboard.

## Test Strategy Exception

- The Vue template placement cannot be exercised through the existing actions-dashboard test harness, and local Playwright execution is unavailable (`Command "playwright" not found`). The behavior is still partly covered by a snapshot/probe test; template placement will be validated by inspecting the rendered data path and local dashboard API.

## GREEN Evidence

- `moon run actions-dashboard:test -f` passed: 34 tests.
- `moon run actions-dashboard:typecheck -f` passed.
- `moon run actions-dashboard:lint -f` passed.
- `git diff --check` passed.
- Local dashboard API at `http://127.0.0.1:3092/api/ops/status?network=testnet` returns `actions-api` with status `warn` and error `Actions API schema is missing finality metadata`; `apps/actions-dashboard/app/pages/index.vue` now renders that service in the backend status section via `actionsApiService`.
