---
id: T150
title: "Fix docs link check flake for GitHub 5xx"
status: done
blockedBy: []
owner: codex
created_at: 2026-03-24T15:10:27Z
updated_at: 2026-03-24T15:11:40Z
---

## Requirements

- Investigate the failing `docs:test` CI job on PR #158 and determine whether the reported external link is actually broken.
- If the URL is valid and the failure is caused by transient GitHub behavior, harden the docs link checker so it tolerates GitHub-side transient 5xx responses without masking real broken links such as `404`.
- Keep the fix narrow to the external-link test behavior. Do not weaken general broken-link detection for other hosts or for definitive client-side failures.
- Add regression coverage for the chosen behavior and verify the docs project test task passes locally.

## Test Plan

- TDD. Reproduce the flaky-host behavior with unit coverage in `apps/docs/tests/check-links.test.ts`, then adjust the categorization/retry behavior and rerun the docs test task.

## RED Evidence

- GitHub Actions run `23496180992`, job `68377824140`, failed `docs:test` because `https://github.com/MinaFoundation/mina-fungible-token` returned `502` from CI even though the repository URL is live outside the failing run.

## GREEN Evidence

- `CI=1 moon run -f docs:test`
- `moon run -f docs:build`
- `curl -I -L https://github.com/MinaFoundation/mina-fungible-token` returned `200`, confirming the linked repository is live and the CI failure was a transient GitHub-side `502`.
- `apps/docs/tests/check-links.test.ts` now treats GitHub-hosted `5xx` responses as transient host failures after the existing retries, while still failing GitHub `404`s and non-GitHub `5xx`s.
