---
id: T121
title: "Add native MINA transfer and unit conversion guidance"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T00:22:41Z
updated_at: 2026-03-12T00:25:40Z
---

## Requirements

- Add agent-usable guidance for sending native MINA from one address to another.
- Include a concrete amount-conversion explanation from human MINA values to the `UInt64` base-unit values expected by GraphQL.
- Include a runnable `curl`-based transfer flow with sender and receiver placeholders, plus any required prerequisite query such as nonce lookup.
- Make it clear that this path is for native MINA payments, and that arbitrary zkApp tokens need token-specific flows instead.
- Keep the guidance inside the shipped `zeko` skill and update tests/evals so it remains present.

## Test Plan

- `BDD`: add failing expectations that require `sendPayment`, unit-conversion guidance, and `from`/`to` transfer examples in the shipped references.
- RED path before implementation: make `moon run use-zeko:test` fail against the current content, then add the transfer guidance until `moon run use-zeko:test` and `moon run use-zeko:check` pass again.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected because the shipped references still lacked native MINA transfer guidance: there was no `sendPayment` mutation example, no explanation that `1 MINA = 1_000_000_000` base units, and no concrete `from`/`to` transfer flow.

## GREEN Evidence

- `moon run use-zeko:test`
- Passed after adding native `sendPayment` guidance, base-unit conversion help, and concrete `from`/`to` transfer examples to the shipped skill.
- `moon run use-zeko:check`
- Passed end to end with the new transfer guidance included in structure checks, external-link validation, endpoint checks, and prompt eval coverage.
