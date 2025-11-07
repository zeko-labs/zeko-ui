<script setup lang="ts">
import NumberFlow from "@number-flow/vue"

const lb = useLeaderboard()
</script>
<template>
  <div class="Wrapper">
    <NumberFlow
      class="Count"
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
    top: 0;
    left: 0;
    color: transparent;
    background: var(--gradients-goldGradient-brand-logo);
    background-clip: text;
  }
}
</style>
<style lang="postcss">
number-flow-vue::part(number) {
  color: oklch(from var(--palette-cosmicGold-50) l c h / 0.5);
}
</style>
