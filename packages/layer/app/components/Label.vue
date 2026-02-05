<script lang="ts" setup>
const { is } = defineProps<{
	is: "pending" | "complete" | "cancelled" | "error"
}>()
</script>
<template>
  <div class="Label" :class="is">
    <template v-if='is === "pending"'>
      <SvgPendingClock />
      <span>Pending</span>
    </template>
    <template v-else-if='is === "complete"'>
      <SvgCompletedCircle />
      <span>Completed</span>
    </template>
    <template v-else-if='is === "cancelled"'>
      <SvgCancelledCircle />
      <span>Cancelled</span>
    </template>
    <template v-else-if='is === "error"'>
      <SvgErrorCircle />
      <span>Error</span>
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
  font-size: var(--typography_fluid-lexend-s);
  font-weight: var(--typography-weight-lexend-semibold);
}

.Table > span {
  width: 9ch;
  display: flex;
  justify-content: center;
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

.cancelled {
  border: 1px solid var(--palette-cancelled-border);
  background: var(--palette-cancelled-background);
  color: var(--palette-cancelled-content);
}

.error {
  border: 1px solid var(--palette-error-border);
  background: var(--palette-error-background);
  color: var(--palette-error-content);
}
</style>
