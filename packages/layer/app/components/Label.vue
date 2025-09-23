<script lang="ts" setup>
// biome-ignore lint/correctness/noUnusedImports: <explanation>
import { CircleXIcon } from "lucide-vue-next"
const { is } = defineProps<{ is: "pending" | "complete" | "error" }>()
</script>
<template>
  <div class="Label" :class="is">
    <Switch>
      <Match :when='is === "pending"'>
        <SvgPendingClock />
        <slot>Pending</slot>
      </Match>
      <Match :when='is === "complete"'>
        <SvgCompletedCircle />
        <slot>Completed</slot>
      </Match>
      <Match :when='is === "error"'>
        <CircleXIcon />
        <slot>Error</slot>
      </Match>
    </Switch>
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
  font-size: var(--typography_fluid-lexend-s);
  font-weight: var(--typography-weight-lexend-semibold);
}

.complete {
  border: 1px solid var(--palette-complete-border);
  background: var(--palette-complete-background);
  color: var(--palette-complete-content);
}

.pending {
  border: 1px solid var(--palette-pending-border);
  background: var(--palette-pending-background);
  color: var(--palette-pending-content);
}

.error {
  border: 1px solid var(--palette-error-border);
  background: var(--palette-error-background);
  color: var(--palette-error-content);
}
</style>
