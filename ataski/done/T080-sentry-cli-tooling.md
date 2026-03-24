---
id: T080
title: "Sentry CLI tooling and README"
status: todo
blockedBy: []
owner: unassigned
created_at: 2026-03-12T00:00:00Z
updated_at: 2026-03-12T00:00:00Z
---

## Requirements

Chore-only changes (no runtime behavior changes):

1. Add a `sentry` moon task in `apps/bridge-ui/moon.yml`:
   ```yaml
   sentry:
     command: "sentry-cli"
     local: true
   ```
2. Create `apps/bridge-ui/.sentryclirc`:
   ```ini
   [defaults]
   org=zeko-labs
   project=zeko-bridge
   ```
3. Add a Sentry CLI section to `apps/bridge-ui/README.md` documenting:
   - Auth: `sentry-cli login` or `SENTRY_AUTH_TOKEN`
   - Common commands: `issues list`, `releases list`
   - Mention `@sentry/mcp` for IDE integration

## Test Plan

Chore/config — no automated tests required. Verify with `moon bridge-ui:sentry -- --version`.

## Test Strategy Exception

Config and documentation only; no runtime behavior changes.
