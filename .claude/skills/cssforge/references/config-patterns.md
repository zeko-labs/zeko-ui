# Config Patterns

## Adding a palette color group

In `packages/design/src/index.ts`, add entries under `colors.palette.value`:

```ts
cancelled: {
    background: "oklch(94.5% 0.012 280)",
    border: "oklch(86% 0.03 280)",
    content: "oklch(52% 0.06 280)"
}
```

This generates CSS variables:

```css
--palette-cancelled-background: oklch(94.5% 0.012 280);
--palette-cancelled-border: oklch(86% 0.03 280);
--palette-cancelled-content: oklch(52% 0.06 280);
```

## Adding a gradient

```ts
gradients: {
    value: {
        myGradient: {
            value: {
                1: {
                    value: "linear-gradient(90deg, var(--1) 0%, var(--2) 100%)",
                    variables: {
                        1: "palette.value.cosmicGold.50",
                        2: "palette.value.cosmicGold.200"
                    }
                }
            }
        }
    }
}
```

## Adding a theme token

```ts
theme: {
    value: {
        light: {
            myToken: {
                value: { color: "var(--1)" },
                variables: { 1: "palette.value.gray.950" }
            }
        }
    }
}
```
