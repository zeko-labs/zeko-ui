<script setup lang="ts">
import { computed } from "vue"
import { theme } from "~~/helpers/theme"

interface Props {
	size?: "small" | "default" | "large"
	variant?: "cta1" | "cta2" | "cta3" | "default"
}

defineOptions({ inheritAttrs: false })

const { size = "default", variant = "default" } = defineProps<Props>()

const isCta = computed(() => variant !== "default")

const buttonStyle = computed(() => {
	const sizes = theme.config.sizes.button[size]
	const colors = theme.config.colors

	const baseStyles = {
		color: theme.config.colors.gray[50].value,
		width: `${sizes.width.value / 16}rem`,
		height: `${sizes.height.value / 16}rem`,
		fontSize: `${sizes.fontSize.value / 16}rem`,
		padding: sizes.padding.value,
		fontWeight: 400,
		radius: `${sizes.radius.value / 16}rem`
	} as const
	const cta = {
		...baseStyles,
		fontWeight: 500,
		borderColor: theme.config.colors.spaceBlue.value
	} as const
	const variants = {
		default: {
			...baseStyles,
			background: colors.gray[950].value,
			borderColor: colors.gray[950].value
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
		}
	} as const
	return variants[variant]
})

const hoverActive = {
	cta: {
		hover: {
			opacity: 0.9
		},
		active: {
			opacity: 0.8
		}
	},
	default: {
		hover: {
			background: theme.config.colors.gray[900].value,
			borderColor: theme.config.colors.gray[900].value
		},
		active: {
			background: theme.config.colors.gray[800].value,
			borderColor: theme.config.colors.gray[800].value
		}
	}
} as const
</script>

<template>
  <button
    class="ZekoButton"
    :class='[`ZekoButton${isCta ? "CTA" : "Default"}`]'
    v-bind="$attrs">
    <slot></slot>
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

.ZekoButtonCTA {
  &:hover {
    opacity: v-bind("hoverActive.cta.hover.opacity");
  }
  &:active {
	opacity: v-bind("hoverActive.cta.active.opacity");
  }
}

.ZekoButtonDefault {
  &:hover {
	background: v-bind("hoverActive.default.hover.background");
	box-shadow: inset 0 0 0 1px v-bind("hoverActive.default.hover.borderColor");
  }
  &:active {
	background: v-bind("hoverActive.default.active.background");
	box-shadow: inset 0 0 0 1px v-bind("hoverActive.default.active.borderColor");
  }
}
</style>
