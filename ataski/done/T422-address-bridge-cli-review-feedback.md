---
id: T422
title: "Address bridge CLI review feedback"
status: done
blockedBy: []
owner: Codex
created_at: 2026-06-20T07:13:05Z
updated_at: 2026-06-20T07:17:00Z
---

## Requirements

- Remove the `create-wallet-env` helper from the Bridge CLI package build/export surface; it is repo tooling and should run from its TypeScript source instead of shipping in the package bundle.
- Update docs app content so the new Bridge CLI endpoint override flags are visible from the docs site, not only the package README include.
- Keep the change narrow to review feedback for PR #220.

## Test Plan

- Test Strategy Exception: this is a package build-surface and docs cleanup, not new runtime bridge behavior. Validate by checking the relevant config/docs diff and running targeted Bridge CLI typecheck/build plus docs typecheck if available.

## RED Evidence

- Not applicable; see Test Strategy Exception.

## GREEN Evidence

- `moon run bridge-cli:test -f -- tests/package-boundary.test.ts tests/create-wallet-env.test.ts` passed: 2 files, 9 tests.
- `node packages/bridge-cli/scripts/create-wallet-env.ts --root "$tmpdir" --name review` created a wallet file under a temporary root.
- `moon run bridge-cli:create-wallet-env -f -- --root "$tmpdir" --name review-moon` created a wallet file under a temporary root through the Moon task.
- `moon run docs:test -f` passed: 2 files, 8 passed, 1 skipped.
- `moon run bridge-cli:typecheck bridge-cli:build docs:build -f` passed; docs build emitted existing VitePress/Rolldown warnings.
- `git diff --check` passed.
