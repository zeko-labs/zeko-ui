---
id: T501
title: "Increase Actions Dashboard control timeout"
status: done
blockedBy: []
owner: codex
created_at: 2026-09-09T11:00:00Z
updated_at: 2026-09-09T11:20:00Z
---
## Requirements

- Prevent the Sepolia Actions Dashboard `rebuild` control from returning 502 solely because the synchronous indexer rebuild exceeds the normal 12-second probe timeout.
- Apply a dedicated longer timeout to indexer control requests without changing status probe timeouts, retry semantics, endpoint selection, authentication, or indexer behavior.
- Keep the dashboard Sepolia-only.

## Test Plan

- Strategy: TDD.
- RED: add focused control-request coverage proving controls use a dedicated long timeout rather than the 12-second probe timeout; run the dashboard test suite before implementation.
- GREEN: implement the dedicated control timeout and run dashboard tests, typecheck, lint, format, and build.

## RED Evidence

- Existing dashboard tests passed before this change, but code inspection showed `runIndexerControl` called `timedFetch` without `timeoutMs`, so rebuild inherited the 12-second `requestTimeoutMs`.
- RED `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:test -f'` failed the new timeout assertion: the dedicated `indexerControlTimeoutMs` was undefined.

## GREEN Evidence

- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:format -f'` passed.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:test -f'` passed: 40 tests.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:typecheck -f'` passed.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:lint -f'` passed.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:build -f'` passed.
- `nix develop -c bash -lc 'pnpm exec moon run actions-dashboard:deploy -f'` passed; Worker version `77e17bdc-e138-4fe1-811f-4bd77f533208` deployed to `actions.dashboard.zeko.io`.
