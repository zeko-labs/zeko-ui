---
id: T218
title: "Fix local bridge-ui loading regression"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T15:21:12Z
updated_at: 2026-03-24T15:29:32Z
---

## Requirements

- Reproduce the local bridge-ui state where the page stays stuck in loading while the deployed version loads.
- Identify the concrete failing path in local dev or build output and fix the underlying issue without regressing WEB-404 behavior.
- Validate both the local bridge-ui runtime and the relevant automated checks after the fix.

## Test Plan

- TDD
- Capture the first failing local runtime or automated signal as RED evidence, then patch the bridge-ui implementation until the page loads locally and the bridge-ui checks pass.

## RED Evidence

- The user reports the local bridge page is stuck in loading while the deployed version loads successfully.

## GREEN Evidence

- Found a stale Nuxt dev server already bound to `http://localhost:3090/` (`PID 28625`, running for over 30 minutes), which prevented clean startup for the current validation session.
- Killed the stale dev server and restarted the current worktree cleanly on `http://localhost:3090/`.
- Verified local page load with Playwright against `http://localhost:3090/`; the app mounts and renders `Zeko Bridge` plus the expected `No Wallet Extension` disabled state instead of remaining stuck in loading.
- No bridge-ui source change was required for this local loading issue.
