---
id: T147
title: "Validate and fix zeko-skills ClawHub metadata"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T14:25:00Z
updated_at: 2026-03-24T14:40:00Z
---

## Requirements

- Validate the current ClawHub and skills.sh findings against the published `zeko` skill and the local `packages/zeko-skills/zeko` source before changing anything.
- Fix only findings that are real, with emphasis on declaring required runtime metadata so the registry no longer flags the skill for undeclared env vars or binaries.
- Investigate the `references/10-agent-workflows.md` "Obfuscated File" finding and either adjust the content to avoid false positives or document why the scanner is wrong.
- Keep the skill concise and public-facing; do not reintroduce monorepo-local references or maintainer-only guidance into the shipped skill.
- Determine whether publishing to ClawHub can be automated from CI in this repo and document the practical constraints.

## Test Plan

- DDD. First reproduce the current findings from the live ClawHub and skills.sh pages and inspect the local skill/package metadata to identify the exact mismatch.
- After the fix, run the package validation tasks, republish the skill to ClawHub, and verify the live registry entry reflects the new metadata and reduced warnings.

## RED Evidence

- Live ClawHub page flags the skill for undeclared env vars / binaries and `skills.sh` shows the socket warning against `references/10-agent-workflows.md`.

## GREEN Evidence

- `moon run -f zeko-skills:test`
- `moon run -f zeko-skills:typecheck`
- `moon run -f zeko-skills:check`
- `moon run -f zeko-skills:publish-clawhub` with `ZEKO_SKILLS_CLAWHUB_VERSION=0.0.2`
- `moon run -f zeko-skills:validate-public-install`
- ClawHub publish succeeded for `zeko@0.0.2` with version id `k971nfby43pdczafm99wbbqzfh83gnp5`.
- Public mirror `zeko-labs/zeko-skills` was manually synced on `main` and the `skills` CLI install still succeeds.
- `skills.sh` Socket audit still shows the old hash `2e10744e771e8a9801b3f7c5dfaca1a1fe40fb61`, so the false-positive page has not reindexed yet.
