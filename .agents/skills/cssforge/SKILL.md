---
name: cssforge
description: "Manage CSS design tokens with cssforge. Use when modifying design tokens, CSS custom properties, color palettes, typography scales, spacing, gradients, or theme variables in the design system. Triggers: editing cssforge.config.ts, adding/changing palette colors, updating design tokens, regenerating CSS from config."
---

# cssforge

cssforge is a zero-runtime design tokens generator. Configuration lives in `cssforge.config.ts`, output is generated into `.cssforge/` and CSS files.

## Key Rule

Never edit generated files directly:

- `.cssforge/output.json`
- `.cssforge/output.ts`
- `app/assets/styles/cssforge.css`

Always edit the source config and regenerate.

## Workflow

1. Edit design tokens in `packages/design/src/index.ts` (the shared config)
2. Regenerate output by running from the repo root:
   ```bash
   moon layer:cssforge
   ```
   This runs: `node node_modules/@hebilicious/cssforge/src/cli --css app/assets/styles/cssforge.css`
3. Verify the generated CSS contains the expected variables

## Config Structure

The config in `packages/design/src/index.ts` uses `defineConfig()` with sections:

- `colors.palette.value` — color palettes (e.g., `pending`, `complete`, `error`)
- `colors.gradients.value` — gradient definitions with variable references
- `colors.theme.value` — theme tokens referencing palette values
- `typography` — fluid type scales
- `spacing` — spacing scales
- `primitives` — custom design tokens

Palette colors can be plain strings (`"oklch(...)"`), or objects with format keys (`{ oklch: "oklch(...)" }`).

## Reference

See `references/config-patterns.md` for examples of adding palette colors, gradients, and theme tokens.
Additional docs and source code can be found at https://github.com/Hebilicious/cssforge.
