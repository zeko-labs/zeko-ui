---
id: T475
title: "show-copied-check-feedback"
status: done
blockedBy: []
owner: pi
created_at: 2026-07-07T00:00:00Z
updated_at: 2026-07-07T00:00:00Z
---

## Requirements

- Copy hash and copy wallet address actions should show a temporary check icon after successful copy.
- The feedback should fade away/reset without adding visible text.
- Keep existing copy/open action UX and accessibility labels.
- Do not commit or push.

## Test Plan

- DDD.
- Run focused bridge-ui typecheck, lint, and format.

## RED Evidence

- Copy actions currently provide no visible confirmation after clipboard write.

## GREEN Evidence

- Copy hash and copy wallet address actions now swap the copy icon to a fading check icon for 1.5s after successful clipboard write.
- Accessibility labels and titles change to copied state during feedback.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:typecheck -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:lint -f` passed.
- `PATH=/tmp/pi-pnpm-bin:$PATH pnpm exec dprint fmt apps/bridge-ui/app/components/Header.vue apps/bridge-ui/app/components/BridgeOperations.vue` formatted the edited files.
- `PATH=/tmp/pi-pnpm-bin:$PATH ./node_modules/.bin/moon run bridge-ui:format -f` passed.
