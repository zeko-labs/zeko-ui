<script lang="ts" setup>
import { theme } from "~~/helpers/theme"
const { is } = defineProps<{ is: "pending" | "complete" }>()
const color = theme.config.colors[is]
const font = theme.config.fonts.lexend.typescale
</script>
<template>
  <div class="Label">
    <template v-if='is === "pending"'>
      <SvgPendingClock />
      <span>Pending</span>
    </template>
    <template v-if='is === "complete"'>
      <SvgCompletedCircle />
      <span>Completed</span>
    </template>
  </div>
</template>
<style lang="postcss" scoped>
.Label {
  display: flex;
  padding: 0.25rem 0.5rem;
  justify-content: center;
  align-items: center;
  width: fit-content;
  gap: 0.25rem;
  border-radius: 0.5rem;
  border: 1px solid v-bind("color.border.value");
  background: v-bind("color.background.value");
  color: v-bind("color.content.value");
  font-size: v-bind("font.scale.s.value");
  font-weight: v-bind("font.weight.semibold.value");
}
</style>
