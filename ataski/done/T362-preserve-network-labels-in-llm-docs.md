---
id: T362
title: "Preserve network labels in LLM docs"
status: done
blockedBy: []
owner: codex
created_at: 2026-06-17T07:44:14Z
updated_at: 2026-06-17T07:46:14Z
---

## Requirements

- Address the accepted Codex review finding that `vitepress-plugin-llms` strips inline `NetworkLabel` Vue components from generated LLM docs.
- Keep docs source content authored with `<NetworkLabel network="..." />` for concrete Zeko network labels.
- Expand generated LLM markdown/text artifacts from the shared `@zeko/networks` user-facing display helper, not hardcoded fallback strings in docs content.
- Ensure generated LLM docs do not contain blank network-label gaps or raw `NetworkLabel` component tags.

## Test Plan

- TDD. First add a focused docs test for the LLM network-label expansion helper and prove it fails before implementation.
- GREEN path: implement a VitePress build postprocessor for LLM artifacts, run docs tests/build, verify `llms-full.txt` contains helper-derived labels and no stripped-label blanks, then rerun Codex review.

## RED Evidence

- `moon run docs:test -f -- network-labels.test.ts` failed as expected because `../.vitepress/llmsNetworkLabels` did not exist yet.

## GREEN Evidence

- `moon run docs:test -f -- network-labels.test.ts` passed: 1 file, 4 tests.
- `moon run docs:build -f` passed.
- `! rg -n "on \?|for the  faucet|like  is|<NetworkLabel|zeko-m:(testnet|mainnet|alphanet|local)" apps/docs/.vitepress/dist/llms-full.txt apps/docs/.vitepress/dist/**/*.md` passed, confirming generated LLM artifacts do not contain stripped-label blanks, raw `NetworkLabel` tags, or internal Zeko-M network ids.
- `rg -n "Zeko Testnet|Zeko Mainnet|Zeko Alphanet" apps/docs/.vitepress/dist/llms-full.txt` showed helper-derived labels in the formerly blank LLM docs lines.
- `moon run docs:test -f` passed: 2 files, 8 passed, 1 skipped.
