---
id: T001
title: "WEB-77: Minor dev-related docs updates + minaprotocol link migration"
status: done
blockedBy: []
owner: claude
created_at: 2026-02-27T00:00:00Z
updated_at: 2026-02-27T01:00:00Z
---

## Scope

Address all WEB-77 checklist items and update all `docs.minaprotocol.com` links
to the new canonical URL `https://docs.o1labs.org/o1js`.

## TDD Exception

Documentation-only changes. No runtime code or business logic is modified.
Validation: `grep docs.minaprotocol.com apps/docs/**/*.md` returns no matches.

## Changes

### WEB-77 checklist

1. `developers/getting-started.md` – added dev environment setup tip box linking to o1js getting-started guide
2. `developers/core-developer-concepts.md` – added links for o1js Deep Dive, ZkProgram guide, and Lumina SDK
3. `developers/guides-tutorials.md` – added Creating a Faucet link
4. `developers/examples-boilerplates.md` – added link to Quick Start guide
5. `developers/api-reference.md` – added link to o1js API Reference
6. `developers/contributing.md` – added Zeko GitHub repo and Discord links
7. `users/user-concepts-explained.md` – updated account creation fee 1 MINA → 0.1 MINA
8. `.vitepress/config.ts` – updated footer: "Docs released under the MIT License."

### minaprotocol → docs.o1labs.org/o1js link migration (8 files)

- `developers/getting-started.md` – 5 links updated
- `introduction/why-zeko.md` – 1 link updated
- `architecture/zeko-core-concepts.md` – 1 link updated
- `background/core-blockchain-concepts.md` – 2 links updated
- `background/mina-protocol.md` – 1 link updated
- `background/smart-contracts.md` – 1 link updated
- `about/glossary.md` – 3 links updated
- `developers/guides/custom-network.md` – 1 link updated

## GREEN evidence

`grep docs.minaprotocol.com apps/docs/**/*.md` → no matches found.
All WEB-77 checklist items addressed.
