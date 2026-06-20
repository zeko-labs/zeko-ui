---
id: T420
title: "Scope PR218 finality observability"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-20T05:44:27Z
updated_at: 2026-06-20T05:52:37Z
---

## Requirements

- Rebuild PR #218 on top of `branch/bridge-finality-hotfix` so the review diff contains only the follow-up scope requested for PR #220.
- Keep the high-level Bridge CLI deposit-loop fix that demotes `canCancelDeposit` read failures to a blocked cancellation diagnostic while preserving normal explicit cancellation behavior.
- Keep useful actions-dashboard observability that marks reachable Actions indexer/API surfaces as warning when the outer finality boundary is behind fetched or pending outer actions, with operator details for the stale boundary.
- Keep only runbook guidance missing from #220: concise finality debugging checks, reporting fields, and local-indexer interpretation. Do not reintroduce stale guidance that treats canonical finality as the default bridge success gate.
- Remove stale SDK `fetchLastCommit` helper scope, old validation notes, low-value tests, and old Ataski changelog entries from the PR diff.

## Test Plan

- BDD. First keep/add targeted CLI and dashboard tests that express the operator-visible behavior: the CLI keeps waiting through a cancellation capability read failure, the dashboard warns on indexer/API finality degradation, and normal caught-up states remain green.
- RED evidence may come from the preserved PR #218 failing-test notes because this branch is being rebuilt from a previously proven RED/GREEN slice; record the specific old failures before implementation.
- GREEN commands: `moon run bridge-cli:test -f`, `moon run actions-dashboard:test -f`, `moon run zeko-skills:test -f`, plus focused typechecks where affected.

## RED Evidence

- Previous PR #218 BDD coverage for `bridge flow > keeps waiting when the deposit cancellation capability check fails` failed before the CLI implementation because `canCancelDeposit failed after 6 attempts: Error getting account data` became the terminal `lastError` instead of the loop continuing to the test wait hook.
- Previous PR #218 dashboard BDD coverage failed before the dashboard implementation because a healthy Actions indexer with `outerNonCanonicalTailCount > 0` and fetched outer block ahead of final outer block was classified as `ok`.
- Previous PR #218 Actions API BDD coverage failed before the dashboard implementation because `commitAsePastSlot` returned a pending outer tail beyond the final commit while `probeActionsApi` still returned `ok`.

## GREEN Evidence

- `moon run bridge-cli:test -f` passed: 23 test files, 129 tests passed, 13 skipped.
- `moon run actions-dashboard:test -f` passed: 1 test file, 37 tests.
- `moon run bridge-cli:typecheck -f` passed.
- `moon run actions-dashboard:typecheck -f` passed.
- `moon run bridge-cli:lint -f` passed.
- `moon run actions-dashboard:lint -f` passed.
- `moon run bridge-cli:format -f` passed.
- `moon run actions-dashboard:format -f` passed.
- `git diff --check` passed.
