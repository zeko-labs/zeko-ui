---
id: T201
title: "clear-deposit-queue-before-submit"
status: done
blockedBy: []
owner: codex
created_at: 2026-05-12T20:25:47Z
updated_at: 2026-05-12T20:45:00Z
---

## Requirements

- The high-level `bridge` command for `mina:testnet -> zeko:testnet` deposits must inspect and resolve existing deposit queue work for the account before submitting a new deposit.
- If an older deposit can be finalized or cancelled, the command must advance that work first instead of calling `submitDeposit`.
- Preserve the existing behavior for resumed sessions that already submitted the current deposit.
- Keep the PR scoped to bridge CLI/SDK bugfix work and validate with the required bridge CLI/SDK targets.

## Test Plan

- TDD: add a bridge CLI flow test that fails when `submitDeposit` is called before an existing finalizable queued deposit is resolved.
- Make the deposit flow start with queue inspection for fresh deposit sessions, then submit only after no pre-existing queue work blocks the new deposit.
- Validate with targeted bridge CLI tests first, then the full required bridge CLI/SDK test/typecheck targets.

## RED Evidence

- Existing `bridgeOperationMachine` routed fresh deposit sessions directly to `submitDeposit` before any deposit status inspection, so a queue item already present for the account could only be handled after the new deposit was submitted.
- Tightened `drains older queued deposits before the new submission appears in status` to assert call order. The expected order is `finalize-older`, `submit-current`, `finalize-current`.

## GREEN Evidence

- `moon run bridge-cli:test -f`
- `moon run bridge-cli:typecheck -f`
- `moon run bridge-sdk:test -f`
- `moon run bridge-sdk:typecheck -f`
