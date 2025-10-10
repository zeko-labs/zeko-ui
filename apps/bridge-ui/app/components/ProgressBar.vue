<script setup lang="ts">
const { steps, step } = defineProps<{
	steps: readonly string[]
	step: number
}>()

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
        <stop offset="0%" stop-color="var(--palette-cosmicGold-200)" />
        <stop offset="50%" stop-color="var(--palette-cosmicGold-100)" />
        <stop offset="100%" stop-color="var(--palette-cosmicGold-50)" />
      </linearGradient>
    </defs>
  </svg>
  <div class="progress-bar">
    <div class="progress-track">
      <template v-for="(stepText, index) of steps" :key="index">
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
          <SvgCheck
            :class="{ check: true, completed: progressClass(index).completed }"
            v-if="index === steps.length - 1"
          />
          <span
            v-if="index === steps.length - 1"
            class="last-label step-label"
            :class="progressClass(steps.length - 1)">
            {{ steps[steps.length - 1] }}
          </span>
        </div>

        <div
          v-if="index < steps.length - 1"
          class="progress-line"
          :class="{ completed: progressClass(index).completed }">
          <span
            class="absolute-step-label step-label"
            :class="{ current: progressClass(index).current }">
            {{ stepText }}
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.progress-bar {
  width: 100%;
  display: grid;
  grid-template-areas:
    "progress progress"
    ". .";
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  container-type: inline-size;
  padding: 0rem 2rem;
  @media (max-width: 1024px) {
    padding: 0rem;
  }
}

.progress-track {
  display: flex;
  grid-area: progress;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
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
    color: transparent;
    &.completed {
      color: white;
    }
  }
}

.step-label {
  font-size: 14px;
  font-weight: 400;
  display: none;
  color: var(--palette-gray-500);
  align-items: center;
  min-width: 20ch;
  &.current {
    display: grid;
    color: var(--palette-gray-950);
    font-weight: 600;
    font-size: 16px;
  }
}

.absolute-step-label {
  position: absolute;
  width: 20%;
  margin: v-bind("`${nodeSize.rem} -${nodeSize.value / 5}rem`");
}

.last-label {
  position: absolute;
  min-width: 24ch;
  margin-bottom: -4.2rem;
  margin-right: -2rem;
}

/* Container query: once the progress bar has enough horizontal space, show all labels */
@container (min-width: 55ch) {
  .step-label {
    display: grid;
  }
}

.progress-line {
  flex-grow: 1;
  height: 2px;
  background: var(--palette-gray-200);
  transition: background 0.6s ease-out;
  &.completed {
    background: var(--gradients-goldGradient-3-inversed);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.progress-node {
  position: relative;
  flex-shrink: 0;
  z-index: 1;
  circle {
    fill: transparent;
    stroke: var(--palette-gray-200);
    stroke-width: 2;
    transition: fill 0.5s ease-out, stroke 0.5s ease-out;
    &.current {
      fill: transparent;
      stroke: url(#goldenGradient);
      stroke-width: 2;
      transform-origin: center;
      animation: rotate 6s linear infinite;
    }
    &.completed {
      fill: url(#goldenGradient);
      stroke: url(#goldenGradient);
      transition-delay: 0.3s;
      animation: none;
    }
    &.future {
      fill: transparent;
      stroke: var(--palette-gray-200);
      stroke-width: 2;
    }
  }
}
</style>
