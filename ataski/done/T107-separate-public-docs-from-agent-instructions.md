---
id: T107
title: "Separate public docs from agent instructions"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-19T19:45:00Z
updated_at: 2026-03-19T19:56:00Z
---

## Requirements

- Remove agent-only guidance from the public bridge-cli package documentation.
- Remove duplicated publishing/release instructions from the public bridge-cli docs when those workflows already live in dedicated internal docs/skills.
- Keep the public README focused on user/operator-facing CLI behavior.
- Move any necessary agent-only guidance into `packages/bridge-cli/AGENTS.md`.
- Refactor or delete internal-only phrasing in `testing.md` so it reads as a maintainer/operator manual rather than a prompt to future agents.

## Test Plan

- RED path:
  - inspect the current bridge-cli docs and confirm the public README still contains agent-only phrasing and duplicated release/publish workflow detail
- GREEN path:
  - update README, testing guide, and AGENTS notes to separate public vs agent-only content cleanly
  - run formatting/lint checks for the touched bridge-cli docs set if needed

## RED Evidence

- `packages/bridge-cli/README.md` still describes the package as agent-first, tells agents what command to reach for, and includes a long operator/publishing checklist that belongs in internal release guidance instead.
- `packages/bridge-cli/testing.md` still contains wording aimed at future agents rather than a neutral maintainer/operator validation guide.

## GREEN Evidence

- Removed agent-first framing and agent-only command guidance from the public package README.
- Deleted the duplicated npm publish / trusted-publisher / release checklist from the public package README and replaced it with pointers to the internal maintainer docs.
- Added an explicit rule in `AGENTS.md` that `README.md` must stay public-facing and must not accumulate agent-only or duplicated release workflow instructions.
- Refactored `testing.md` to remove direct prompt-style language aimed at future agents while keeping the one-command validation contract clear for maintainers/operators.
- Removed the public README references to internal maintainer/agent docs so it stands on its own as public-facing package documentation.
- Reduced overlap between `AGENTS.md` and `testing.md` by making `testing.md` own the validation procedure and `AGENTS.md` only add agent-specific workflow constraints plus cross-references.
- `moon run bridge-cli:lint`
