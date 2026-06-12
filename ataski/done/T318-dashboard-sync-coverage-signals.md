---
id: T318
title: "Dashboard sync coverage signals"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T13:57:06Z
updated_at: 2026-06-10T14:04:10Z
---

## Requirements

- Change dashboard auto-refresh from 5 seconds to 30 seconds.
- Add bounded retries for status/archive/daemon GraphQL and HTTP probes to reduce transient unavailable states.
- Replace noisy flattened database detail output with a concise at-a-glance sync assessment.
- Add an archive coverage signal that identifies whether the action-indexer DB is missing archive actions after the last indexed L1/L2 action block.
- Rename confusing "outer/inner" UI labels to L1/L2 action terms.
- Clarify finality wording: L1 finality is block-based, L2 finality is time/action-based, and archive pending/canonical wording should not be the primary signal.

## Test Plan

- DDD: add the coverage signal using live archive/indexer semantics, then validate with focused utility tests, Nuxt typecheck/lint/build, and a browser-level local render check.

## RED Evidence

- The current dashboard shows a 5s refresh, raw flattened DB fields, "outer/inner" labels, and a confusing L2 finality card expressed as pending txs.

## GREEN Evidence

- `moon run ops-dashboard:test` passed with 9 tests.
- `moon run ops-dashboard:typecheck` passed.
- `moon run ops-dashboard:lint` passed.
- `moon run ops-dashboard:build` passed. Build emitted only existing Browserslist/baseline data age warnings.
- Live `http://localhost:3092/api/ops/status?network=testnet` returned in about 1.5s with both `l1ActionCoverageStatus=current` and `l2ActionCoverageStatus=current`, and zero missing action counts.
- Browser-level Chrome DevTools Protocol check of `http://localhost:3092/?network=testnet` showed `Live 30s`, one initial status fetch, `Indexer ok`, both L1/L2 coverage cards as "DB has latest archive actions", and L2 finality as "2 actions waiting finality".
