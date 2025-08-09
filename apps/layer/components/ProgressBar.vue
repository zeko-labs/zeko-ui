<script setup lang="ts">
import { theme } from "@zeko/design"

const {
	steps = [
		"Send transfer request",
		"Sign send transaction",
		"Claim transfer",
		"Sign claim transaction",
		"Transfer complete"
	],
	step = 2
} = defineProps<{ steps?: string[]; step?: number }>()

const currentStepIndex = computed(() =>
	Math.min(Math.max(step, 0), steps.length - 1)
)

const progressClass = (index: number) => {
	const completed =
		index < currentStepIndex.value ||
		(index === steps.length - 1 && currentStepIndex.value === steps.length - 1)
	const current = index === currentStepIndex.value
	return { completed, current, future: !completed && !current }
}

const cosmicGold = theme.config.colors.cosmicGold
const gray = theme.config.colors.gray[200].value
const rawNodeSize = 24

const nodeSize = {
	px: `${rawNodeSize}px`,
	rem: `${rawNodeSize / 16}rem`,
	value: rawNodeSize
}

/**
 * Note: We are using grid-template-areas and margin tricks to reproduce the design as faithfully as possible.
 *
 */
</script>

<template>
  <svg width="0" height="0" style="position: absolute">
    <defs>
      <linearGradient id="goldenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" :stop-color="cosmicGold[200].value" />
        <stop offset="50%" :stop-color="cosmicGold[100].value" />
        <stop offset="100%" :stop-color="cosmicGold[50].value" />
      </linearGradient>
    </defs>
  </svg>
  <div class="progress-bar">
    <div class="progress-track">
      <template v-for="(step, index) of steps" :key="index">
        <div class="node-wrapper">
          <svg
            class="progress-node"
            :width="rawNodeSize"
            :height="rawNodeSize"
            :viewBox="`0 0 ${rawNodeSize} ${rawNodeSize}`">
            <circle
              :cx="rawNodeSize / 2"
              :cy="rawNodeSize / 2"
              r="11"
              :class="progressClass(index)"
            />
          </svg>
          <SvgCheck class="check" v-if="index === steps.length - 1" />
        </div>

        <div
          v-if="index < steps.length - 1"
          class="progress-line"
          :class="{ completed: progressClass(index).completed }">
          <label
            class="absolute-step-label step-label"
            :class="{ current: progressClass(index).current }">
            {{ step }}
          </label>
        </div>
      </template>
    </div>
    <label
      class="legend step-label"
      :class="progressClass(steps.length - 1)">
      {{ steps[steps.length - 1] }}
    </label>
  </div>
</template>

<style lang="postcss" scoped>
.progress-bar {
  width: 75vw;
  display: grid;
  grid-template-areas:
    "progress progress ."
    ". . legend";
  grid-template-rows: 1fr 1fr;
  grid-template-columns: 1fr 1fr auto;
}

.progress-track {
  display: flex;
  grid-area: progress;
  align-items: center;
  justify-content: space-between;
  padding: 4px;
}

.node-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  .check {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 2;
  }
}

.legend {
  grid-area: legend;
  display: inline-flex;
  align-items: center;
  margin-left: v-bind("`-${nodeSize.rem}`");
}

.step-label {
  font-size: 14px;
  font-weight: 400;
  color: v-bind("theme.config.colors.gray[500].value");
  &.current {
    color: v-bind("theme.config.colors.gray[950].value");
    font-weight: 400;
    transform: scale(1.05);
  }
}

.absolute-step-label {
  position: absolute;
  width: 20%;
  margin: v-bind("`${nodeSize.rem} -${nodeSize.rem}`");
}

.progress-line {
  flex-grow: 1;
  height: 2px;
  background: v-bind("gray");
  transition: background 0.6s ease-out;
  &.completed {
    background: v-bind(
      "theme.config.gradients.goldGradient[3].inversedBackground.value"
    );
  }
}

.progress-node {
  position: relative;
  flex-shrink: 0;
  z-index: 1;
  circle {
    fill: transparent;
    stroke: v-bind("gray");
    stroke-width: 2;
    transition: fill 0.5s ease-out, stroke 0.5s ease-out;
    &.current {
      fill: transparent;
      stroke: url(#goldenGradient);
      stroke-width: 2;
    }
    &.completed {
      fill: url(#goldenGradient);
      stroke: url(#goldenGradient);
      transition-delay: 0.3s;
    }
    &.future {
      fill: transparent;
      stroke: v-bind("gray");
      stroke-width: 2;
    }
  }
}
</style>
