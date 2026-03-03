---
id: T025
title: "Move changesets + releases to monorepo, standalone repo = public mirror"
status: done
blockedBy: []
owner: main-agent
created_at: 2026-03-03T00:00:00Z
updated_at: 2026-03-03T00:00:00Z
---

Move changesets, versioning, building, publishing, and GitHub releases to the monorepo.
The standalone `zeko-labs/faucet-cli` repo becomes a simple public source mirror.

## Scope (chore/CI/docs — no source-code changes)

1. Update `.changeset/config.json` — add `fixed` group for faucet-cli packages
2. Delete `packages/faucet-cli/.changeset/`
3. Create `.github/workflows/changesets.yaml`
4. Create `.github/workflows/release-faucet-cli.yaml`
5. Rewrite `.github/workflows/sync-faucet-cli.yaml` — force-push clean commit
6. Delete `packages/faucet-cli/.github/workflows/release.yml`
7. Rewrite `packages/faucet-cli/RELEASE.md`
8. Update `packages/faucet-cli/README.md` — add public mirror note
