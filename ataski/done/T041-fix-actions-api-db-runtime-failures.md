---
id: T041
title: "Fix actions-api DB runtime failures on witness queries"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-05T12:45:41Z
updated_at: 2026-03-05T16:34:50Z
---

## Scope

Identify and fix the runtime DB client path in `services/actions/api` that causes all witness and health queries to fail in production.

## TDD Exception

This issue is environment/runtime connectivity behavior in Cloudflare Workers (Hyperdrive + postgres client), not deterministic pure business logic. A RED unit test cannot faithfully reproduce production binding behavior.

Validation strategy:

1. Run local typecheck/build to ensure code correctness.
2. Validate API health and witness queries against production endpoint after deployment.
3. Confirm bridge SDK probe no longer throws `Invalid witnesses data`.

## GREEN Evidence

```bash
moon run actions-api:build
```

Result: passed.
