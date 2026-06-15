---
id: T326
title: "Actions dashboard"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T00:00:00Z
updated_at: 2026-06-13T00:00:00Z
---

## Requirements

- Provide a single dashboard for Zeko action-indexer, L1/L2 archive, and L1/L2 daemon state.
- Support URL-based mainnet/testnet selection, live refresh, and explicit Start, Stop, Rebuild, and Reset controls.
- Keep indexer API tokens server-side and protect the dashboard/API behind Cloudflare Access with GitHub organization auth.
- Report actionable indexer/database/archive lag signals without false positives for expected L2 archive/indexer differences.
- Preserve deployment through Cloudflare Workers and repository CI.

## Test Plan

- BDD: cover dashboard utility behavior, Cloudflare Access configuration, status/control API contracts, network defaults, token handling, and regressions from review.

## RED Evidence

- Supersedes the prior dashboard micro-tasks that were squashed before main advanced, including Access setup, network switching, real-time refresh, data-path fixes, outer public key correction, reset/rebuild copy, token security, and Codex review fixes.

## GREEN Evidence

- Dashboard test, typecheck, lint, and build passed during the dashboard implementation.
- Cloudflare deploy succeeded for the dashboard Worker.
- PR CI passed after the review fixes.
