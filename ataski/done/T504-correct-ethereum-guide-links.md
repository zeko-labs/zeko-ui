---
id: T504
title: "correct-ethereum-guide-links"
status: done
blockedBy: [T502, T503]
owner: root
created_at: 2026-09-24T14:14:31Z
updated_at: 2026-09-24T14:15:53Z
---
## Requirements

Fix links introduced or retained in the app, package README and public agent-guide copy that use nonexistent current documentation routes. Preserve the existing docs route names. Use /users/guides/zeko-bridge, /users/getting-started, and /users/guides/dapp as appropriate. Work in the isolated ethereum-app-copy task worktree. Also scope public skill finality guidance to L2 action visibility, preserving the Ethereum gateway requirement for finalized L1 deposit logs. Do not change runtime logic or protocol identifiers.

## Test Plan

BDD: verify the reader's destination exists in the generated docs site. Review found broken route targets before source edits. Validate links against the rendered documentation output, including absolute links from Vue templates and transcluded package/skill markdown; run existing relevant docs/skill tests as needed. No shallow source-string tests.

## RED Evidence

Independent review identified new /users/guides/using-zeko-bridge and /users/guides/getting-started links with no built pages or redirects; existing docs link tests do not cover these Vue/transcluded sources. Correct output pages are /users/guides/zeko-bridge.html and /users/getting-started.html.

## GREEN Evidence

- Verified all 20 absolute docs.zeko.io URLs in changed Vue, markdown and TypeScript sources against the rendered documentation pages and fragment IDs: all targets exist.
- `moon run zeko-skills:test`: 21 tests passed.
- `git diff --check`: passed.
- Independent review of finality copy confirmed the correction preserves Ethereum L1 finality requirements and pending L2 row visibility as separate concepts.
