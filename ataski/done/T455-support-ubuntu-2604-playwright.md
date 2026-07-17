---
id: T455
title: "Support Ubuntu 26.04 Playwright setup"
status: done
blockedBy: []
owner: codex
created_at: 2026-07-17T18:19:17Z
updated_at: 2026-07-17T18:24:42Z
---

## Requirements

- Make the checked-in `bridge-ui:playwright-install` task work natively on Ubuntu 26.04 without a host-platform override.
- Upgrade the Bridge UI's direct Playwright development dependency to the first release line with official Ubuntu 26.04 support and refresh the lockfile surgically.
- Preserve the existing Chromium installation and browser test workflow on supported CI hosts.

## Test Plan

- BDD: use the existing Moon task as the acceptance boundary.
- RED: demonstrate that `moon run bridge-ui:playwright-install -f` fails because Playwright 1.55 rejects `ubuntu26.04-x64`.
- GREEN: rerun the install task after the dependency upgrade, then run `bridge-ui:test-ci` and the relevant format/lint/typecheck checks.

## RED Evidence

- `moon run bridge-ui:playwright-install -f` failed on Ubuntu 26.04 with `ERROR: Playwright does not support chromium on ubuntu26.04-x64` under Playwright 1.55.0.
- `pnpm --dir apps/bridge-ui exec playwright install chromium` reproduced the same rejection without Moon or `--with-deps`.

## GREEN Evidence

- `pnpm install --frozen-lockfile --offline` accepted the surgically updated lockfile and installed Playwright 1.61.1.
- `moon run bridge-ui:playwright-install -f` installed Chromium and its Ubuntu 26.04 dependencies successfully.
- `moon run bridge-ui:test-ci -f` passed the browser test task.
- `moon run zeko-ui:format bridge-ui:format bridge-ui:lint bridge-ui:typecheck -f` passed all relevant repository checks.
