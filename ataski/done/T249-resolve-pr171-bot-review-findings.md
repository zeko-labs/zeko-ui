---
id: T249
title: "Resolve PR 171 bot review findings"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-21T07:30:47Z
updated_at: 2026-05-21T07:46:42Z
---

## Requirements

- Validate and address the current Copilot and Gemini review comments on PR 171.
- Confirm the older Gemini comments for deposit index precision and verbose-gated prover logging are already fixed.
- Fix valid runtime behavior findings:
  - `setL2` must configure Mina with `runtime.config.zekoArchiveUrl` as the archive endpoint.
  - `finalizeDeposit` post-mutation verification must use the same optional `runtime.bridge.fetchSyncedOuterActionState` hook used by deposit state context.
  - `pollProvingResult` must report malformed or unsupported proving payloads with clear errors instead of raw JSON parse errors or a generic unreachable error.
  - The legacy `Bridge` constructor path must fail early with a meaningful error if the runtime argument count is invalid.
- Resolve valid maintainability findings:
  - Use the shared transaction types in `index.ts`.
  - Make the default bridge fee literal explicit.
  - Name and explain the protocol-specific skipped withdrawal action index.

## Test Plan

- TDD.
- RED: add focused bridge SDK tests that fail on the current branch for `setL2` archive configuration, malformed proving payload handling, unsupported proving payload handling, `finalizeDeposit` hook reuse after polling, and invalid legacy constructor arity.
- GREEN: implement the smallest SDK changes that satisfy those tests, then run `moon run bridge-sdk:test -f`, `moon run bridge-sdk:typecheck -f`, and `moon run bridge-sdk:build -f`.

## RED Evidence

- `moon run bridge-sdk:test -f` failed as expected after adding TDD coverage:
  - `prover.test.ts` still surfaced raw JSON parse errors for malformed proving payloads.
  - `prover.test.ts` still surfaced `Should not be reachable` for unsupported proving payloads.
  - `network.test.ts` showed L2 archive requests going to `http://l2.test` instead of `http://l2-archive.test`.
  - `bridge-constructor.test.ts` showed incomplete legacy constructor calls did not fail early.

## GREEN Evidence

- `moon run bridge-sdk:test -f` passed: 10 test files, 45 tests.
- `moon run bridge-sdk:typecheck -f` passed.
- `moon run bridge-sdk:build -f` passed.
- `moon run bridge-sdk:format -f` passed.
- `moon run bridge-sdk:lint -f` completed successfully with the existing `src/types.ts` `noExplicitAny` warnings.
