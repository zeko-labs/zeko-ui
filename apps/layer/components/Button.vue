<script setup lang="ts">
import { computed, useSlots } from "vue"
import { theme } from "@zeko/design"

interface Props {
	variant?: "auro" | "black" | "cta1" | "cta2" | "cta3" | "default"
}

defineOptions({ inheritAttrs: false })

const { variant = "default" } = defineProps<Props>()

const isCta = computed(() => variant !== "default")

const size = computed(() => (isCta.value ? "cta" : "default"))

const buttonStyle = computed(() => {
	const sizes = theme.config.sizes.button[size.value]
	const colors = theme.config.colors

	const baseStyles = {
		color: theme.config.colors.gray[50].value,
		width: sizes.width.value,
		height: sizes.height.value,
		padding: sizes.padding.value,
		radius: sizes.radius.value,
		fontSize: sizes.fontSize.value,
		fontWeight: sizes.fontWeight.value,
		hover: {
			background: "inherit",
			borderColor: "inherit",
			opacity: "inherit"
		}
	} as const
	const cta = {
		...baseStyles,
		borderColor: theme.config.semantic.border.primary.value,
		disabled: {
			color: theme.config.semantic.content.secondary.value,
			borderColor: theme.config.semantic.border.primaryDark.value,
			background: theme.config.semantic.background.secondary.value
		},
		hover: { background: "inherit", borderColor: "inherit", opacity: 0.9 },
		active: { background: "inherit", borderColor: "inherit", opacity: 0.8 }
	} as const
	const variants = {
		default: {
			...baseStyles,
			background: colors.gray[950].value,
			borderColor: colors.gray[950].value,
			disabled: {
				color: theme.config.semantic.content.tertiary.value,
				borderColor: theme.config.semantic.background.secondary.value,
				background: theme.config.semantic.background.secondary.value
			},
			hover: {
				opacity: "inherit",
				background: theme.config.colors.gray[900].value,
				borderColor: theme.config.colors.gray[900].value
			},
			active: {
				opacity: "inherit",
				background: theme.config.colors.gray[800].value,
				borderColor: theme.config.colors.gray[800].value
			}
		},
		cta1: {
			...cta,
			background: theme.config.gradients.buttonGradients.cta1.background.value
		},
		cta2: {
			...cta,
			background: theme.config.gradients.buttonGradients.cta2.background.value
		},
		cta3: {
			...cta,
			background: theme.config.gradients.buttonGradients.cta3.background.value
		},
		auro: {
			...cta,
			radius: "6.25rem",
			background: "oklch(0.513 0.2408 278.15)"
		},
		black: {
			...cta,
			background:
				"linear-gradient(263deg, var(--colors-gray-950) 0%, var(--colors-gray-700) 100%)",
			borderColor: "rgba(255, 255, 255, 0.20)"
		}
	} as const
	return variants[variant]
})

const plus = computed(
	() =>
		useSlots().default?.()?.[0]?.children === "Add Token" &&
		size.value === "default"
)
const className = computed(
	() =>
		(
			({
				auro: "ZekoButtonAuro",
				black: "ZekoButtonBlack",
				cta1: "ZekoButtonCTA",
				cta2: "ZekoButtonCTA",
				cta3: "ZekoButtonCTA",
				default: "ZekoButtonDefault"
			}) as const
		)[variant]
)
</script>

<template>
  <button
    type="button"
    class="ZekoButton"
    :class="className"
    v-bind="$attrs">
    <SvgAuro v-if='variant === "auro"' />
    <span>
      <slot></slot>
    </span>
    <SvgPlus v-if="plus" />
  </button>
</template>

<style lang="postcss" scoped>
.ZekoButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: all 0.3s ease;
  cursor: pointer;
  border: none;
  outline: 0;
  gap: 0.5rem;
  font-weight: v-bind("buttonStyle.fontWeight");
  background: v-bind("buttonStyle.background");
  color: v-bind("buttonStyle.color");
  border-radius: v-bind("buttonStyle.radius");
  width: v-bind("buttonStyle.width");
  height: v-bind("buttonStyle.height");
  padding: v-bind("buttonStyle.padding");
  font-size: v-bind("buttonStyle.fontSize");
  box-shadow: inset 0 0 0 1px v-bind("buttonStyle.borderColor");
  background-clip: padding-box;
}

.ZekoButtonBlack {
  &:disabled {
    background: var(--semantic-background-secondary);
    color: var(--colors-gray-400);
    box-shadow: inset 0 0 0 1px oklch(0.8607 0 0);
    cursor: not-allowed;
  }
  &:not(:disabled) {
    &:hover {
      background: linear-gradient(
        var(--colors-gray-950),
        var(--colors-gray-950)
      );
    }
    &:active {
      background: var(--colors-gray-950);
      box-shadow: inset 0 0 0 3px v-bind("buttonStyle.borderColor");
    }
  }
}

.ZekoButtonAuro {
  text-decoration-line: underline;
  text-underline-position: under;
  box-shadow: 0px 12px 16px 0px oklch(0.6559 0.1665 285.18 / 24%);
  display: flex;
  align-items: center;
  justify-content: center;
  span {
    margin-top: -2px;
  }
  &:not(:disabled) {
    &:hover {
      background: oklch(0.4451 0.2184 277.23);
    }
    &:active {
      background: oklch(0.513 0.2408 278.15);
      box-shadow: inset 0 0 0 3px oklch(0.4451 0.2184 277.23);
    }
  }
}

.ZekoButtonCTA {
  &:disabled {
    box-shadow: inset 0 0 0 1px v-bind("buttonStyle.disabled.borderColor");
    background: v-bind("buttonStyle.disabled.background");
    color: v-bind("buttonStyle.disabled.color");
    cursor: not-allowed;
  }
  &:not(:disabled) {
    &:hover {
      opacity: v-bind("buttonStyle.hover.opacity");
    }
    &:active {
      opacity: v-bind("buttonStyle.active.opacity");
    }
  }
}

.ZekoButtonDefault {
  &:disabled {
    background: v-bind("buttonStyle.disabled.background");
    box-shadow: inset 0 0 0 1px v-bind("buttonStyle.disabled.borderColor");
    color: v-bind("buttonStyle.disabled.color");
    cursor: not-allowed;
  }
  &:not(:disabled) {
    &:hover {
      background: v-bind("buttonStyle.hover.background");
      box-shadow: inset 0 0 0 1px v-bind("buttonStyle.hover.borderColor");
    }
    &:active {
      background: v-bind("buttonStyle.active.background");
      box-shadow: inset 0 0 0 1px v-bind("buttonStyle.active.borderColor");
    }
  }
}
</style>
