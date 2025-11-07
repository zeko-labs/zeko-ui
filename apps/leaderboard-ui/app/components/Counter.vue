<script setup lang="ts">
import NumberFlow from "@number-flow/vue"

const opacity = [0, 0.25]
const lb = useLeaderboard()
const show = ref(opacity[0])
</script>
<template>
  <div class="Wrapper">
    <NumberFlow
      class="Count"
      @animationsstart="(show = opacity[1])"
      @animationsfinish="(show = opacity[0])"
      :value="lb.transactionCount"
      :format='{ notation: "standard", useGrouping: true }'
    />
    <div class="Count Static">
      {{ lb.transactionCount.toLocaleString("en-US") }}
    </div>
  </div>
</template>
<style lang="postcss" scoped>
.Wrapper {
  position: relative;
}
.Count {
  font-family: "Russo One", sans-serif;
  font-size: var(--typography_fluid-lexend-h3);
  &.Static {
    position: absolute;
    letter-spacing: 1px;
    top: 0;
    left: 0;
    color: transparent;
    background: var(--gradients-goldGradient-brand-logo);
    background-clip: text;
    &:hover {
      background: none;
    }
  }
}
</style>
<style lang="postcss">
number-flow-vue::part(number) {
  user-select: none;

  color: oklch(from var(--palette-cosmicGold-50) l c h / v-bind(show));
}
</style>
