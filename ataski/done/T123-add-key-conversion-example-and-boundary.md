---
id: T123
title: "Add key conversion example and boundary"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-12T10:30:55Z
updated_at: 2026-03-12T10:34:01Z
---

## Requirements

- Add an example showing how to derive a public key from a private key with `o1js`.
- Add a matching example for parsing and validating a public key string.
- State clearly that deriving a private key from a public key is not possible, so the reverse direction is parse/validate only, not reconstruction.
- Keep this guidance in the shipped `o1js` inline-script reference and update tests so it remains present.

## Test Plan

- `BDD`: add a failing expectation that requires the build reference to mention `PrivateKey.fromBase58`, `toPublicKey`, `PublicKey.fromBase58`, and the irreversible boundary.
- RED path before implementation: make `moon run use-zeko:test` fail against the current content, then add the example and explanation until `moon run use-zeko:test` and `moon run use-zeko:check` pass again.

## RED Evidence

- `moon run use-zeko:test`
- Failed as expected because the build reference still lacked an explicit explanation that you cannot derive a private key from a public key, even though it already had the inline `o1js` scripting section.

## GREEN Evidence

- `moon run use-zeko:test`
- Passed after adding a practical private-key-to-public-key example, a public-key parsing example, and an explicit note that the reverse direction cannot reconstruct a private key.
- `moon run use-zeko:check`
- Passed end to end with the new key-boundary guidance preserved by structure checks, endpoint validation, link validation, and eval coverage.
