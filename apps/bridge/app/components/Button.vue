<script setup lang="ts">
import { computed } from "vue"
import { theme } from "~~/helpers/theme"

interface Props {
	variant?: "cta1" | "cta2" | "cta3" | "default"
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
		width: sizes.width,
		height: sizes.height,
		padding: sizes.padding.value,
		radius: sizes.radius.value,
		fontSize: sizes.fontSize.value,
		fontWeight: sizes.fontWeight.value
	} as const
	const cta = {
		...baseStyles,
		borderColor: theme.config.semantic.border.primary.value,
		disabled: {
			color: theme.config.semantic.content.secondary.value,
			borderColor: theme.config.semantic.border.primaryDark.value,
			background: theme.config.semantic.background.secondary.value
		},
		hover: { opacity: 0.9 },
		active: { opacity: 0.8 }
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
				background: theme.config.colors.gray[900].value,
				borderColor: theme.config.colors.gray[900].value
			},
			active: {
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
		}
	} as const
	return variants[variant]
})

const plus = computed(
	() =>
		useSlots().default?.()?.[0].children === "Add Token" &&
		size.value === "default"
)
</script>

<template>
  <button
    type="button"
    class="ZekoButton"
    :class='[`ZekoButton${isCta ? "CTA" : "Default"}`]'
    v-bind="$attrs">
    <slot></slot>
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
