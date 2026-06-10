---
id: T298
title: "bridge-validator scheduled both routes"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-10T13:13:52Z
updated_at: 2026-06-10T13:19:21Z
---

## Requirements

- Change bridge validator scheduled cron handling so every scheduled event creates two workflow definitions: deposit route `mina-to-zeko` and withdrawal route `zeko-to-mina`.
- Keep the two scheduled workflow IDs route-specific and distinct by including both `routeKey` and `scheduledTime`.
- Remove scheduled route alternation logic that is no longer needed.
- Preserve manual single-route workflow creation and CLI route queue behavior.
- Preserve independent Slack reporting by leaving each workflow outcome reporting path unchanged.
- Do not use cancellation, create wallets, or hard-code the cron schedule in tests, docs, or types.
- Update service metadata, docs, and tests so they describe both routes per scheduled event instead of alternating route behavior.

## Test Plan

- TDD. First update focused unit tests so the existing implementation fails because a scheduled event returns one alternating workflow and service metadata still says `alternating`.
- RED checks: run the bridge-validator test target or focused test file and record the failing assertions.
- GREEN checks: implement the smallest runtime/docs/metadata change, then run `moon run bridge-validator:type-cf -f`, `moon run bridge-validator:test -f`, `moon run bridge-validator:typecheck -f`, `moon run bridge-validator:lint -f`, `moon run bridge-validator:build -f`, and `git diff --check`.

## RED Evidence

- `moon run bridge-validator:test -f` failed as expected before implementation.
- Failing assertions:
  - `tests/validator.test.ts` expected one scheduled event to produce both `mina-to-zeko` and `zeko-to-mina`, but received only one workflow.
  - `tests/index.test.ts` expected service metadata mode `both-per-event`, but received `alternating`.
  - `tests/index.test.ts` expected README schedule docs to say each scheduled event starts two workflows, but README still described one alternating workflow.

## GREEN Evidence

- `moon run bridge-validator:type-cf -f` passed and regenerated `worker-configuration.d.ts` with no tracked diff.
- `moon run bridge-validator:test -f` passed: 4 test files, 38 tests.
- `moon run bridge-validator:typecheck -f` passed.
- `moon run bridge-validator:lint -f` passed: Biome checked 16 files with no fixes.
- `moon run bridge-validator:build -f` passed; tsdown emitted the existing `resolve.tsconfigFilename` deprecation warning.
- `git diff --check` passed.
