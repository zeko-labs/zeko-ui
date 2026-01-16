<script setup lang="ts">
import { computed, useSlots } from "vue"

interface Props {
	variant?:
		| "auro"
		| "black"
		| "cta1"
		| "cta2"
		| "cta3"
		| "main"
		| "cancel"
		| "default"
}

defineOptions({ inheritAttrs: false })

const { variant = "default" } = defineProps<Props>()

const isCta = computed(() => variant !== "default")

const plus = computed(
	() => useSlots().default?.()?.[0]?.children === "Add Token" && !isCta.value
)

const className = computed(
	() =>
		(
			({
				auro: "ZekoButtonAuro",
				black: "ZekoButtonBlack",
				cta1: "ZekoButtonCTA1",
				cta2: "ZekoButtonCTA2",
				cta3: "ZekoButtonCTA3",
				main: "ZekoButtonMain",
				cancel: "ZekoButtonCancel",
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
  /* Layout */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  /* Typography */
  font-family: inherit;
  font-size: var(--button-default-fontSize);
  font-weight: var(--typography-weight-lexend-regular);
  color: var(--palette-gray-50);

  /* Dimensions - default (overridden by CTA variants) */
  width: var(--button-default-width);
  height: var(--button-default-height);
  padding: var(--button-default-padding);

  /* Visual */
  border: none;
  border-radius: var(--button-default-radius);
  outline: 0;
  background-clip: padding-box;
  cursor: pointer;

  /* Animation */
  transition: all 0.3s ease;

  /* Shared disabled styles for all variants */
  &:where(:disabled) {
    cursor: not-allowed;
  }
}

/* ==================== Default Variant ==================== */
.ZekoButtonDefault {
  background: var(--palette-gray-950);
  box-shadow: inset 0 0 0 1px var(--palette-gray-950);

  &:disabled {
    background: var(--theme-light-background-secondary);
    box-shadow: inset 0 0 0 1px var(--theme-light-border-secondary);
    color: var(--theme-light-content-tertiary);
  }

  &:not(:disabled):hover {
    background: var(--palette-gray-900);
    box-shadow: inset 0 0 0 1px var(--palette-gray-900);
  }

  &:not(:disabled):active {
    background: var(--palette-gray-800);
    box-shadow: inset 0 0 0 1px var(--palette-gray-800);
  }
}

/* ==================== CTA Variants (Shared Styles) ==================== */
:is(.ZekoButtonCTA1, .ZekoButtonCTA2, .ZekoButtonCTA3, .ZekoButtonAuro, .ZekoButtonBlack, .ZekoButtonMain) {
  /* CTA size overrides */
  width: var(--button-cta-width);
  height: var(--button-cta-height);
  padding: var(--button-cta-padding);
  font-size: var(--button-cta-fontSize);
  font-weight: var(--button-cta-fontWeight);
}

/* Gold gradient CTA buttons */
:is(.ZekoButtonCTA1, .ZekoButtonCTA2, .ZekoButtonCTA3) {
  border-radius: var(--button-cta-radius);
  box-shadow: inset 0 0 0 1px var(--theme-light-border-primary);

  &:disabled {
    background: var(--theme-light-background-secondary);
    box-shadow: inset 0 0 0 1px var(--theme-light-border-primaryDark);
    color: var(--theme-light-content-secondary);
  }

  &:not(:disabled):hover {
    opacity: 0.9;
  }

  &:not(:disabled):active {
    opacity: 0.8;
  }
}

.ZekoButtonCTA1 {
  background: var(--gradients-goldGradient-button-cta-1);
}

.ZekoButtonCTA2 {
  background: var(--gradients-goldGradient-button-cta-2);
}

.ZekoButtonCTA3 {
  background: var(--gradients-goldGradient-button-cta-3);
}

.ZekoButtonMain {
  background: var(--gradients-goldGradient-button-main);
  padding: 0.75rem 1rem;
  min-width: 8.75rem;
  font-size: var(--typography_fluid-lexend-l);

  &:disabled {
    background: var(--theme-light-background-secondary);
    color: var(--theme-light-content-quaternary);
  }

  &:not(:disabled):hover {
    opacity: 0.9;
  }

  &:not(:disabled):active {
    opacity: 0.8;
  }
}

/* ==================== Auro Variant ==================== */
.ZekoButtonAuro {
  /* Unique Auro styling */
  border-radius: 6.25rem;
  background: oklch(0.513 0.2408 278.15);
  box-shadow: 0 12px 16px 0 oklch(0.6559 0.1665 285.18 / 24%);
  text-decoration-line: underline;
  text-underline-position: under;

  & span {
    margin-top: -2px;
  }

  &:not(:disabled):hover {
    background: oklch(0.4451 0.2184 277.23);
  }

  &:not(:disabled):active {
    background: oklch(0.513 0.2408 278.15);
    box-shadow: inset 0 0 0 3px oklch(0.4451 0.2184 277.23);
  }
}

/* ==================== Cancel Variant ==================== */
.ZekoButtonCancel {
  --bg: var(--palette-error-background);
  border-radius: var(--button-cta-radius);
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--palette-error-border);
  color: var(--palette-persianRed-600);

  &:disabled {
    background: var(--theme-light-background-secondary);
    box-shadow: inset 0 0 0 1px var(--theme-light-border-secondary);
    color: var(--theme-light-content-tertiary);
  }

  &:not(:disabled):hover {
    background: oklch(from var(--bg) l c h / 0.85);
  }

  &:not(:disabled):active {
    background: oklch(from var(--bg) l c h / 0.95);
    box-shadow: inset 0 0 0 3px var(--bg);
  }
}

/* ==================== Black Variant ==================== */
.ZekoButtonBlack {
  border-radius: var(--button-cta-radius);
  background: linear-gradient(
    263deg,
    var(--palette-gray-950) 0%,
    var(--palette-gray-700) 100%
  );
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);

  &:disabled {
    background: var(--theme-light-background-secondary);
    box-shadow: inset 0 0 0 1px oklch(0.8607 0 0);
    color: var(--palette-gray-400);
  }

  &:not(:disabled):hover {
    background: linear-gradient(
      var(--palette-gray-950),
      var(--palette-gray-950)
    );
  }

  &:not(:disabled):active {
    background: var(--palette-gray-950);
    box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.2);
  }
}
</style>
